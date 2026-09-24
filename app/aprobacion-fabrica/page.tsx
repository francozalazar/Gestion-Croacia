"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import { CheckCircle2, User, Scissors, X, ArrowRight, ShieldAlert, FileText, DollarSign, MapPin } from "lucide-react";

export default function AprobacionFabricaPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalRemito, setModalRemito] = useState<any | null>(null);
  const [procesando, setProcesando] = useState(false);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, rol")
      .eq("id", user.id)
      .single();

    setPerfil(profile);

    // Cargar remitos pendientes de aprobación o ya enviados a cortar (hasta que se finalicen)
    const { data: solFabrica } = await supabase
      .from("solicitudes_fabrica")
      .select("*, creador:profiles!creado_por(nombre, apellido)")
      .in("estado", ["PENDIENTE_APROBACION", "ENVIADO_A_CORTAR"])
      .order("id", { ascending: false });

    const mapeadas = (solFabrica || []).map((s) => ({
      ...s,
      usuario_creador: s.creador
        ? `${s.creador.nombre} ${s.creador.apellido || ""}`.trim()
        : "Oficina",
    }));

    setSolicitudes(mapeadas);
    setCargando(false);
  }

  async function enviarACortar(id: number) {
    if (perfil?.rol !== "ADMIN") return;
    setProcesando(true);

    const { error } = await supabase
      .from("solicitudes_fabrica")
      .update({ estado: "ENVIADO_A_CORTAR" })
      .eq("id", id);

    if (error) {
      alert("Error al actualizar: " + error.message);
      setProcesando(false);
      return;
    }

    // Creamos la solicitud principal vinculada (visibilidad de oficina),
    // igual que desde la pantalla de detalle del remito.
    const remito =
      modalRemito?.id === id
        ? modalRemito
        : solicitudes.find((s) => s.id === id);

    if (remito) {
      const { data: existente } = await supabase
        .from("solicitudes")
        .select("id")
        .eq("solicitud_fabrica_id", id)
        .maybeSingle();

      if (!existente) {
        let clienteId = null;

        const { data: clienteExistente } = await supabase
          .from("clientes")
          .select("id")
          .eq("nombre", remito.cliente_nombre)
          .maybeSingle();

        if (clienteExistente) {
          clienteId = clienteExistente.id;
        } else {
          const {
            data: { user: usuarioCreador },
          } = await supabase.auth.getUser();

          const { data: nuevoCliente } = await supabase
            .from("clientes")
            .insert({
              nombre: remito.cliente_nombre,
              direccion: remito.direccion,
              localidad: remito.localidad,
              telefono: remito.cliente_telefono,
              creado_por: usuarioCreador?.id || null,
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

        if (clienteId && remito.direccion) {
          try {
            await supabase.from("direcciones").insert({
              cliente_id: clienteId,
              direccion: remito.direccion,
              localidad: remito.localidad || null,
            });
          } catch {
            // sin la tabla direcciones todavía, no pasa nada
          }
        }

        const { error: errorSolicitud } = await supabase
          .from("solicitudes")
          .insert({
            cliente_id: clienteId,
            cliente_nombre: remito.cliente_nombre,
            cliente_telefono: remito.cliente_telefono,
            direccion: remito.direccion,
            localidad: remito.localidad,
            fecha: remito.fecha,
            horario_desde: remito.horario_desde,
            horario_hasta: remito.horario_hasta,
            tipo_visita: remito.tipo_visita || "Instalación",
            observaciones: remito.observaciones,
            estado: "ASIGNADO_FABRICA",
            creado_por: user?.id,
            solicitud_fabrica_id: id,
          });

        if (errorSolicitud) {
          alert(
            "El remito se envió a cortar pero hubo un error al crear la solicitud de oficina: " +
              errorSolicitud.message
          );
        }
      }
    }

    setModalRemito(null);
    await cargarDatos();
    setProcesando(false);
  }

  async function finalizarRemito(id: number) {
    if (perfil?.rol !== "ADMIN") return;
    if (!confirm("¿Estás seguro de finalizar este remito de fábrica?")) return;
    setProcesando(true);

    const { error } = await supabase
      .from("solicitudes_fabrica")
      .update({ estado: "FINALIZADO" })
      .eq("id", id);

    if (error) {
      alert("Error al finalizar: " + error.message);
    } else {
      setModalRemito(null);
      await cargarDatos();
    }
    setProcesando(false);
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 md:p-10">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          Aprobación de Fábrica
        </h1>
        <p className="text-xs text-slate-500 mb-8">
          Revisión de remitos de fábrica. Los enviados a cortar permanecen aquí hasta que el administrador finalice el remito.
        </p>

        {cargando ? (
          <p className="text-center text-sm text-slate-400 py-10">Cargando remitos de fábrica...</p>
        ) : solicitudes.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center max-w-md mx-auto shadow-xs border border-slate-100">
            <CheckCircle2 size={40} className="mx-auto text-emerald-500 mb-3" />
            <p className="text-sm text-slate-600 font-medium">No hay remitos pendientes en este momento.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
            {solicitudes.map((s) => {
              const enviadoACortar = s.estado === "ENVIADO_A_CORTAR";

              return (
                <div
                  key={s.id}
                  onClick={() => setModalRemito(s)}
                  className={`cursor-pointer rounded-2xl bg-white p-6 shadow-xs border transition hover:shadow-md flex flex-col justify-between ${
                    enviadoACortar
                      ? "border-blue-400 bg-blue-50/20"
                      : "border-amber-300 hover:border-amber-400"
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-center mb-2 gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        Remito #{s.numero_remito || s.id}
                      </span>
                      
                      {/* ETIQUETAS DE ESTADO Y SALDO PENDIENTE */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-md font-semibold ${
                            enviadoACortar
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {enviadoACortar ? "Enviado a cortar" : "Pendiente de aprobación"}
                        </span>

                        {enviadoACortar && (
                          <span className="text-xs px-2 py-0.5 rounded-md font-semibold bg-red-100 text-red-800">
                            Saldo Restante: ${s.saldo_restante ? s.saldo_restante.toLocaleString() : "0"}
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="text-lg font-bold text-slate-900">{s.cliente_nombre || "Cliente sin nombre"}</h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1 uppercase">
                      {s.direccion} {s.localidad ? `- ${s.localidad}` : ""}
                    </p>

                    <p className="text-xs text-slate-600 mt-3 line-clamp-2">
                      <strong>Detalle:</strong> {s.observaciones || "Sin especificaciones."}
                    </p>

                    <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 border-t border-slate-100 pt-2">
                      <User size={13} className="text-slate-400" />
                      <span>Cargado por:</span>
                      <span className="font-semibold text-slate-800">
                        {s.usuario_creador}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Ver detalles y gestionar</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL MÁS GRANDE CON INFORMACIÓN COMPLETA */}
        {modalRemito && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-3xl rounded-3xl bg-white p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setModalRemito(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  Remito #{modalRemito.numero_remito || modalRemito.id}
                </span>
                <span
                  className={`text-xs px-3 py-1 rounded-md font-semibold ${
                    modalRemito.estado === "ENVIADO_A_CORTAR"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {modalRemito.estado === "ENVIADO_A_CORTAR" ? "Enviado a cortar" : "Pendiente de aprobación"}
                </span>

                {modalRemito.estado === "ENVIADO_A_CORTAR" && (
                  <span className="text-xs px-3 py-1 rounded-md font-semibold bg-red-100 text-red-800">
                    Saldo pendiente: ${modalRemito.saldo_restante ? modalRemito.saldo_restante.toLocaleString() : "0"}
                  </span>
                )}
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                {modalRemito.cliente_nombre || "Cliente sin nombre"}
              </h2>

              <p className="text-sm font-medium text-slate-600 mt-1 flex items-center gap-1.5">
                <MapPin size={16} className="text-slate-400" />
                {modalRemito.direccion} {modalRemito.localidad ? `- ${modalRemito.localidad}` : ""}
              </p>

              {/* CONTENEDOR DE DATOS COMPLETOS */}
              <div className="mt-6 space-y-6">
                
                {/* 1. Datos Generales y Creador */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2 text-slate-700">
                  <p className="text-slate-400 font-bold uppercase tracking-wider mb-2">Información general</p>
                  <p><strong>Cargado por:</strong> {modalRemito.usuario_creador}</p>
                  <p><strong>Tipo de visita:</strong> {modalRemito.tipo_visita || "No especificado"}</p>
                  <p><strong>Fecha estimada / pactada:</strong> {modalRemito.fecha || "No definida"}</p>
                </div>

                {/* 2. Observaciones / Datos de la cortina */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-1 text-slate-700">
                  <p className="text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <FileText size={14} /> Observaciones y especificaciones de la cortina
                  </p>
                  <p className="whitespace-pre-wrap text-slate-800 leading-relaxed">
                    {modalRemito.observaciones || "Sin especificaciones cargadas."}
                  </p>
                </div>

                {/* 3. Datos Comerciales */}
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs space-y-2 text-slate-700">
                  <p className="text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <DollarSign size={14} /> Datos comerciales y pagos
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <p className="text-slate-500">Total en pesos:</p>
                      <p className="text-sm font-bold text-slate-900">
                        {modalRemito.total_pesos ? `$${modalRemito.total_pesos.toLocaleString()}` : "$0"}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Saldo restante:</p>
                      <p className="text-sm font-bold text-emerald-700">
                        {modalRemito.saldo_restante !== null && modalRemito.saldo_restante !== undefined
                          ? `$${modalRemito.saldo_restante.toLocaleString()}`
                          : "$0"}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Seña:</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {modalRemito.sena_porcentaje ? `${modalRemito.sena_porcentaje}%` : "0%"} 
                        {modalRemito.sena_pesos ? ` ($${modalRemito.sena_pesos.toLocaleString()})` : ""}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Medio de pago:</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {modalRemito.medio_pago || "No especificado"}
                      </p>
                    </div>
                  </div>

                  {modalRemito.aclaracion_pago && (
                    <div className="pt-2 border-t border-slate-200 mt-2">
                      <p className="text-slate-500">Aclaración de pago / Facturación:</p>
                      <p className="text-slate-800 font-medium">{modalRemito.aclaracion_pago}</p>
                    </div>
                  )}
                </div>

              </div>

              {/* ACCIONES EXCLUSIVAS PARA ADMIN */}
              {perfil?.rol === "ADMIN" ? (
                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  {modalRemito.estado === "PENDIENTE_APROBACION" && (
                    <button
                      onClick={() => enviarACortar(modalRemito.id)}
                      disabled={procesando}
                      className="rounded-xl bg-blue-600 px-6 py-3 text-xs font-semibold text-white hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      <Scissors size={14} /> Enviar a cortar
                    </button>
                  )}

                  {modalRemito.estado === "ENVIADO_A_CORTAR" && (
                    <button
                      onClick={() => finalizarRemito(modalRemito.id)}
                      disabled={procesando}
                      className="rounded-xl bg-emerald-600 px-6 py-3 text-xs font-semibold text-white hover:bg-emerald-700 transition flex items-center gap-2 disabled:opacity-50 shadow-sm"
                    >
                      <CheckCircle2 size={14} /> Finalizar remito
                    </button>
                  )}
                </div>
              ) : (
                <div className="mt-8 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-amber-800 bg-amber-50 p-3 rounded-xl border border-amber-200">
                  <ShieldAlert size={16} />
                  <span>Las acciones de aprobación y finalización están reservadas para el Administrador.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
