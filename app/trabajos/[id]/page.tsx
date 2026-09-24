import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import CompletarTrabajo from "@/components/CompletarTrabajo";
import Link from "next/link";

export default async function TrabajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { id } = await params;
  const { origen } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // =========================
  // PERFIL
  // =========================

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || !["TECNICO", "FABRICA"].includes(perfil.rol)) {
    redirect("/dashboard");
  }

  const solicitudId = Number(id);

  if (Number.isNaN(solicitudId)) {
    notFound();
  }

  const esFabrica = origen === "fabrica";

  // Vista normalizada para renderizar igual ambos origenes
  let vista: {
    id: number;
    numero: string | number;
    estado: string;
    cliente_nombre: string | null;
    cliente_telefono: string | null;
    direccion: string | null;
    localidad: string | null;
    fecha: string | null;
    horario_desde: string | null;
    horario_hasta: string | null;
    tipo_visita: string | null;
    observaciones: string | null;
    trabajo_realizado: string | null;
    observaciones_tecnico: string | null;
    firma_cliente: string | null;
    aclaracion_cliente: string | null;
  };

  if (esFabrica) {
    // =========================
    // TRABAJO DE FABRICA (REMITO)
    // =========================

    const { data: asignacion } = await supabase
      .from("asignaciones")
      .select("*")
      .eq("solicitud_fabrica_id", solicitudId)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (!asignacion) {
      notFound();
    }

    const { data: remito, error } = await supabase
      .from("solicitudes_fabrica")
      .select("*")
      .eq("id", solicitudId)
      .single();

    if (error || !remito) {
      notFound();
    }

    // Los datos del trabajo completado se guardan en la solicitud principal
    const { data: padre } = await supabase
      .from("solicitudes")
      .select("*")
      .eq("solicitud_fabrica_id", solicitudId)
      .maybeSingle();

    vista = {
      id: remito.id,
      numero: remito.numero_remito || remito.id,
      estado: remito.estado,
      cliente_nombre: remito.cliente_nombre || null,
      cliente_telefono: remito.cliente_telefono || null,
      direccion: remito.direccion || null,
      localidad: remito.localidad || null,
      fecha: remito.fecha || padre?.fecha || null,
      horario_desde: remito.horario_desde || padre?.horario_desde || null,
      horario_hasta: remito.horario_hasta || padre?.horario_hasta || null,
      tipo_visita: remito.tipo_visita || padre?.tipo_visita || null,
      observaciones: remito.observaciones || null,
      trabajo_realizado: padre?.trabajo_realizado || null,
      observaciones_tecnico: padre?.observaciones_tecnico || null,
      firma_cliente: padre?.firma_cliente || null,
      aclaracion_cliente: padre?.aclaracion_cliente || null,
    };
  } else {
    // =========================
    // SOLICITUD NORMAL
    // =========================

    const { data: asignacion } = await supabase
      .from("asignaciones")
      .select("*")
      .eq("solicitud_id", solicitudId)
      .eq("usuario_id", user.id)
      .maybeSingle();

    if (!asignacion) {
      notFound();
    }

    const { data: solicitud, error } = await supabase
      .from("solicitudes")
      .select("*")
      .eq("id", solicitudId)
      .single();

    if (error || !solicitud) {
      notFound();
    }

    let cliente = null;

    if (solicitud.cliente_id) {
      const { data } = await supabase
        .from("clientes")
        .select("*")
        .eq("id", solicitud.cliente_id)
        .maybeSingle();

      cliente = data;
    }

    vista = {
      id: solicitud.id,
      numero: solicitud.numero || solicitud.id,
      estado: solicitud.estado,
      cliente_nombre: cliente?.nombre || solicitud.cliente_nombre || null,
      cliente_telefono:
        cliente?.telefono || solicitud.cliente_telefono || null,
      direccion: solicitud.direccion || null,
      localidad: solicitud.localidad || null,
      fecha: solicitud.fecha || null,
      horario_desde: solicitud.horario_desde || null,
      horario_hasta: solicitud.horario_hasta || null,
      tipo_visita: solicitud.tipo_visita || null,
      observaciones: solicitud.observaciones || null,
      trabajo_realizado: solicitud.trabajo_realizado || null,
      observaciones_tecnico: solicitud.observaciones_tecnico || null,
      firma_cliente: solicitud.firma_cliente || null,
      aclaracion_cliente: solicitud.aclaracion_cliente || null,
    };
  }

  return (
    <div className="flex min-h-screen bg-gray-100">

      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido}
        rol={perfil.rol}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 md:p-8 pt-20 md:pt-8">

        {/* ENCABEZADO */}

        <div className="mb-6">

          <Link
            href="/trabajos"
            className="mb-4 inline-block text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Volver a mis trabajos
          </Link>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <div className="flex items-center gap-3">

                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                  #{vista.numero}
                </span>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {vista.estado}
                </span>

              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-bold text-slate-900">
                Detalle del trabajo
              </h1>

            </div>

          </div>

        </div>

        {/* DATOS DEL CLIENTE */}

        <div className="mb-6 rounded-xl bg-white p-6 shadow">

          <h2 className="mb-5 text-xl font-bold text-slate-900">
            Datos del cliente
          </h2>

          <div className="grid gap-5 md:grid-cols-2">

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Cliente
              </p>

              <p className="mt-1 text-base font-medium text-slate-900">
                {vista.cliente_nombre || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Teléfono
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.cliente_telefono || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Dirección
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.direccion || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Localidad
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.localidad || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Fecha
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.fecha || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Horario
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.horario_desde || "-"}
                {" "}
                {vista.horario_hasta
                  ? `- ${vista.horario_hasta}`
                  : ""}
              </p>
            </div>

          </div>

        </div>

        {/* TRABAJO SOLICITADO */}

        <div className="mb-6 rounded-xl bg-white p-6 shadow">

          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Trabajo solicitado
          </h2>

          <div className="rounded-xl bg-slate-50 p-5">

            <p className="text-sm font-semibold text-slate-500">
              Tipo de visita
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900">
              {vista.tipo_visita || "No especificado"}
            </p>

            {vista.observaciones && (
              <div className="mt-5">

                <p className="text-sm font-semibold text-slate-500">
                  Indicaciones de oficina
                </p>

                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {vista.observaciones}
                </p>

              </div>
            )}

          </div>

        </div>

        {/* COMPLETAR */}

        <CompletarTrabajo
          solicitudId={vista.id}
          estado={vista.estado}
          trabajoRealizado={vista.trabajo_realizado}
          observacionesTecnico={vista.observaciones_tecnico}
          firmaCliente={vista.firma_cliente}
          aclaracionCliente={vista.aclaracion_cliente}
          tipoVisita={vista.tipo_visita}
          esFabrica={esFabrica}
        />

      </main>

    </div>
  );
}
