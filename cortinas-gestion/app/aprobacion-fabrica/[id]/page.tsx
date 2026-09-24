"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/cliente";
import { ArrowLeft } from "lucide-react";

type SolicitudFabrica = {
  id: number;
  numero_remito: number;
  cliente_nombre: string;
  cliente_telefono: string | null;
  direccion: string;
  localidad: string | null;
  fecha: string | null;
  horario_desde: string | null;
  horario_hasta: string | null;
  tipo_visita: string | null;
  observaciones: string | null;
  total_pesos: number | null;
  saldo_restante: number | null;
  sena_porcentaje: number | null;
  sena_pesos: number | null;
  medio_pago: string | null;
  estado: string;
  created_at: string;
  fecha_enviada_cortar: string | null;
  fecha_finalizado: string | null;
};

export default function DetalleAprobacionFabricaPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();

  const [solicitud, setSolicitud] =
    useState<SolicitudFabrica | null>(null);

  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const id = Number(params.id);

  useEffect(() => {
    cargarSolicitud();
  }, [id]);

  async function cargarSolicitud() {
    if (!id || Number.isNaN(id)) {
      setError("ID de solicitud inválido.");
      setCargando(false);
      return;
    }

    setCargando(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("No hay una sesión iniciada.");
      setCargando(false);
      return;
    }

    const { data: perfil, error: errorPerfil } = await supabase
      .from("profiles")
      .select("rol")
      .eq("id", user.id)
      .single();

    if (errorPerfil) {
      console.error(errorPerfil);
      setError(errorPerfil.message);
      setCargando(false);
      return;
    }

    if (perfil?.rol !== "ADMIN") {
      setError("No tenés permiso para acceder a esta sección.");
      setCargando(false);
      return;
    }

    const { data, error: errorSolicitud } = await supabase
      .from("solicitudes_fabrica")
      .select("*")
      .eq("id", id)
      .single();

    if (errorSolicitud) {
      console.error(errorSolicitud);
      setError(errorSolicitud.message);
      setCargando(false);
      return;
    }

    setSolicitud(data);
    setCargando(false);
  }

  async function enviarACortar() {
    if (!solicitud) return;

    if (solicitud.estado === "EN_CORTE") {
      setMensaje("Esta solicitud ya fue enviada a cortar.");
      return;
    }

    if (solicitud.estado === "FINALIZADO") {
      setMensaje("Esta solicitud ya está finalizada.");
      return;
    }

    const confirmar = window.confirm(
      `¿Enviar el remito Nº ${solicitud.numero_remito} a cortar? Esto lo pasará directo a la bandeja de fábrica.`
    );

    if (!confirmar) return;

    setProcesando(true);
    setMensaje("");
    setError("");

    const fechaActual = new Date().toISOString();

    // 1. Actualizamos el estado en solicitudes_fabrica
    const { error: errorUpdate } = await supabase
      .from("solicitudes_fabrica")
      .update({
        estado: "EN_CORTE",
        fecha_enviada_cortar: fechaActual,
      })
      .eq("id", solicitud.id);

    if (errorUpdate) {
      console.error(errorUpdate);
      setError(errorUpdate.message);
      setProcesando(false);
      return;
    }

    // 2. CREAMOS EL REGISTRO EN LA TABLA PRINCIPAL `solicitudes` PARA QUE APAREZCA EN FÁBRICA
    // Buscamos o creamos el cliente primero si es necesario, o usamos los datos directamente en la solicitud
    let clienteId = null;
    
    // Verificamos si ya existe un cliente con ese nombre o lo creamos
    const { data: clienteExistente } = await supabase
      .from("clientes")
      .select("id")
      .eq("nombre", solicitud.cliente_nombre)
      .maybeSingle();

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: nuevoCliente } = await supabase
        .from("clientes")
        .insert({
          nombre: solicitud.cliente_nombre,
          direccion: solicitud.direccion,
          localidad: solicitud.localidad,
          telefono: solicitud.cliente_telefono,
        })
        .select("id")
        .single();
      
      if (nuevoCliente) {
        clienteId = nuevoCliente.id;
      }
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Insertamos en la tabla `solicitudes` con estado "ASIGNADO_FABRICA"
    const { error: errorSolicitudPrincipal } = await supabase
      .from("solicitudes")
      .insert({
        cliente_id: clienteId,
        cliente_nombre: solicitud.cliente_nombre,
        cliente_telefono: solicitud.cliente_telefono,
        direccion: solicitud.direccion,
        localidad: solicitud.localidad,
        fecha: solicitud.fecha,
        horario_desde: solicitud.horario_desde,
        horario_hasta: solicitud.horario_hasta,
        tipo_visita: solicitud.tipo_visita || "Instalación",
        observaciones: solicitud.observaciones,
        estado: "ASIGNADO_FABRICA", // Estado que lee la pantalla de fábrica
        creado_por: user?.id,
      });

    if (errorSolicitudPrincipal) {
      console.error("Error al pasar a la tabla de solicitudes:", errorSolicitudPrincipal);
      setError("Se actualizó el remito pero hubo un error al enviarlo a fábrica: " + errorSolicitudPrincipal.message);
      setProcesando(false);
      return;
    }

    setMensaje("La solicitud fue enviada a cortar y ya figura en los trabajos de fábrica.");

    setSolicitud({
      ...solicitud,
      estado: "EN_CORTE",
      fecha_enviada_cortar: fechaActual,
    });

    setProcesando(false);
  }

  async function finalizar() {
    if (!solicitud) return;

    if (solicitud.estado === "FINALIZADO") {
      setMensaje("Esta solicitud ya está finalizada.");
      return;
    }

    const confirmar = window.confirm(
      `¿Marcar como FINALIZADO el remito Nº ${solicitud.numero_remito}?`
    );

    if (!confirmar) return;

    setProcesando(true);
    setMensaje("");
    setError("");

    const fechaFinalizado = new Date().toISOString();

    const { error: errorUpdate } = await supabase
      .from("solicitudes_fabrica")
      .update({
        estado: "FINALIZADO",
        fecha_finalizado: fechaFinalizado,
      })
      .eq("id", solicitud.id);

    if (errorUpdate) {
      console.error(errorUpdate);
      setError(errorUpdate.message);
      setProcesando(false);
      return;
    }

    setMensaje("La solicitud fue marcada como finalizada.");

    setSolicitud({
      ...solicitud,
      estado: "FINALIZADO",
      fecha_finalizado: fechaFinalizado,
    });

    setProcesando(false);
  }

  function formatoPesos(valor: number | null) {
    if (valor === null || valor === undefined) {
      return "-";
    }

    return `$ ${Number(valor).toLocaleString("es-AR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`;
  }

  function formatoFecha(fecha: string | null) {
    if (!fecha) return "-";

    return new Date(fecha).toLocaleDateString("es-AR");
  }

  if (cargando) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/aprobacion-fabrica"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Volver a aprobación de fábrica
          </Link>

          <div className="rounded-xl bg-white p-6 shadow-sm">
            Cargando solicitud...
          </div>
        </div>
      </main>
    );
  }

  if (error || !solicitud) {
    return (
      <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/aprobacion-fabrica"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Volver a aprobación de fábrica
          </Link>

          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
            {error || "No se encontró la solicitud."}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-5xl">

        <div className="mb-6">
          <Link
            href="/aprobacion-fabrica"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Volver a aprobación de fábrica
          </Link>
        </div>

        {/* ENCABEZADO */}
        <div className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div>
              <p className="text-sm text-slate-500">
                Solicitud de fabricación
              </p>

              <h1 className="text-3xl font-bold">
                Remito Nº {solicitud.numero_remito}
              </h1>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-4 py-2 text-sm font-semibold ${
                solicitud.estado === "FINALIZADO"
                  ? "bg-green-100 text-green-800"
                  : solicitud.estado === "EN_CORTE"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-yellow-100 text-yellow-800"
              }`}
            >
              {solicitud.estado}
            </span>

          </div>
        </div>

        {mensaje && (
          <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* DATOS DEL CLIENTE */}
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Datos del cliente
          </h2>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <p className="text-xs font-medium text-slate-500">
                Cliente
              </p>
              <p className="mt-1 font-semibold">
                {solicitud.cliente_nombre}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Teléfono
              </p>
              <p className="mt-1">
                {solicitud.cliente_telefono || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Dirección
              </p>
              <p className="mt-1">
                {solicitud.direccion}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Localidad
              </p>
              <p className="mt-1">
                {solicitud.localidad || "-"}
              </p>
            </div>

          </div>
        </section>

        {/* DATOS DE LA FABRICACIÓN */}
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Datos de fabricación
          </h2>

          <div className="grid gap-5 md:grid-cols-3">

            <div>
              <p className="text-xs font-medium text-slate-500">
                Fecha
              </p>
              <p className="mt-1">
                {formatoFecha(solicitud.fecha)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Horario
              </p>
              <p className="mt-1">
                {solicitud.horario_desde || "-"}
                {" - "}
                {solicitud.horario_hasta || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Tipo
              </p>
              <p className="mt-1">
                {solicitud.tipo_visita || "-"}
              </p>
            </div>

          </div>

          <div className="mt-6">
            <p className="mb-2 text-xs font-medium text-slate-500">
              Observaciones / datos de las cortinas
            </p>

            <div className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
              {solicitud.observaciones || "-"}
            </div>
          </div>
        </section>

        {/* DATOS ECONÓMICOS */}
        <section className="mb-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Datos económicos
          </h2>

          <div className="grid gap-5 md:grid-cols-4">

            <div>
              <p className="text-xs font-medium text-slate-500">
                Total
              </p>
              <p className="mt-1 text-lg font-bold">
                {formatoPesos(solicitud.total_pesos)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Seña %
              </p>
              <p className="mt-1">
                {solicitud.sena_porcentaje ?? "-"}%
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Seña $
              </p>
              <p className="mt-1">
                {formatoPesos(solicitud.sena_pesos)}
              </p>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500">
                Saldo restante
              </p>
              <p className="mt-1 text-lg font-bold">
                {formatoPesos(solicitud.saldo_restante)}
              </p>
            </div>

          </div>

          <div className="mt-5">
            <p className="text-xs font-medium text-slate-500">
              Medio de pago
            </p>
            <p className="mt-1">
              {solicitud.medio_pago || "-"}
            </p>
          </div>
        </section>

        {/* ACCIONES ADMIN */}
        <section className="rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold">
            Acciones
          </h2>

          <div className="flex flex-col gap-3 sm:flex-row">

            <button
              type="button"
              onClick={enviarACortar}
              disabled={
                procesando ||
                solicitud.estado === "EN_CORTE" ||
                solicitud.estado === "FINALIZADO"
              }
              className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {procesando
                ? "Procesando..."
                : "Enviar a cortar"}
            </button>

            <button
              type="button"
              onClick={finalizar}
              disabled={
                procesando ||
                solicitud.estado === "FINALIZADO"
              }
              className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Finalizado
            </button>

          </div>

          <p className="mt-4 text-sm text-slate-500">
            Al enviar a cortar, la solicitud se genera automáticamente en la bandeja de fábrica con estado asignado.
          </p>
        </section>

      </div>
    </main>
  );
}