import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import CompletarTrabajo from "@/components/CompletarTrabajo";

export default async function TrabajoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

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

  // =========================
  // VERIFICAR ASIGNACIÓN
  // =========================

  const { data: asignacion } = await supabase
    .from("asignaciones")
    .select("*")
    .eq("solicitud_id", solicitudId)
    .eq("usuario_id", user.id)
    .single();

  // Si no está asignado a este usuario,
  // no puede ver el trabajo.
  if (!asignacion) {
    notFound();
  }

  // =========================
  // SOLICITUD
  // =========================

  const { data: solicitud, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("id", solicitudId)
    .single();

  if (error || !solicitud) {
    notFound();
  }

  // =========================
  // CLIENTE
  // =========================

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", solicitud.cliente_id)
    .single();

  return (
    <div className="flex min-h-screen bg-gray-100">

      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido}
        rol={perfil.rol}
      />

      <main className="ml-64 flex-1 p-8">

        {/* ENCABEZADO */}

        <div className="mb-6">

          <button
            onClick={() => {}}
            className="mb-4 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Volver a mis trabajos
          </button>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

            <div>

              <div className="flex items-center gap-3">

                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                  #{solicitud.numero}
                </span>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {solicitud.estado}
                </span>

              </div>

              <h1 className="mt-3 text-3xl font-bold text-slate-900">
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
                {cliente?.nombre || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Teléfono
              </p>

              <p className="mt-1 text-base text-slate-700">
                {cliente?.telefono || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Dirección
              </p>

              <p className="mt-1 text-base text-slate-700">
                {solicitud.direccion || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Localidad
              </p>

              <p className="mt-1 text-base text-slate-700">
                {solicitud.localidad || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Fecha
              </p>

              <p className="mt-1 text-base text-slate-700">
                {solicitud.fecha || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Horario
              </p>

              <p className="mt-1 text-base text-slate-700">
                {solicitud.horario_desde || "-"}
                {" "}
                {solicitud.horario_hasta
                  ? `- ${solicitud.horario_hasta}`
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
              {solicitud.tipo_visita}
            </p>

            {solicitud.observaciones && (
              <div className="mt-5">

                <p className="text-sm font-semibold text-slate-500">
                  Indicaciones de oficina
                </p>

                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {solicitud.observaciones}
                </p>

              </div>
            )}

          </div>

        </div>

        {/* COMPLETAR */}

        <CompletarTrabajo
          solicitudId={solicitud.id}
          estado={solicitud.estado}
          trabajoRealizado={solicitud.trabajo_realizado}
          observacionesTecnico={
            solicitud.observaciones_tecnico
          }
          firmaCliente={solicitud.firma_cliente}
          aclaracionCliente={
            solicitud.aclaracion_cliente
          }
        />

      </main>

    </div>
  );
}