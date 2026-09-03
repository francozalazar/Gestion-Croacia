import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

export default async function MisTrabajosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || !["TECNICO", "FABRICA"].includes(perfil.rol)) {
    redirect("/dashboard");
  }

  // Traemos las asignaciones del técnico ordenadas por la prioridad
  const { data: asignaciones, error } = await supabase
    .from("asignaciones")
    .select("*")
    .eq("usuario_id", user.id)
    .order("prioridad", {
      ascending: true,
      nullsFirst: false,
    });

  let solicitudes: any[] = [];

  if (asignaciones && asignaciones.length > 0) {
    const solicitudIds = asignaciones.map(
      (a) => a.solicitud_id
    );

    // FILTRO DIRECTO EN SUPABASE: Excluimos los finalizados de cuajo
    const { data } = await supabase
      .from("solicitudes")
      .select("*")
      .in("id", solicitudIds)
      .not("estado", "ilike", "FINALIZADO"); // 'ilike' ignora mayúsculas/minúsculas

    if (data) {
      // Mapeamos para asociar la prioridad de la asignación a cada solicitud
      const solicitudesConPrioridad = data.map((solicitud) => {
        const asig = asignaciones.find((a) => a.solicitud_id === solicitud.id);
        return {
          ...solicitud,
          prioridad: asig?.prioridad ?? 99,
        };
      });

      // Ordenamos por prioridad (menor número = más arriba)
      solicitudesConPrioridad.sort((a, b) => a.prioridad - b.prioridad);

      solicitudes = solicitudesConPrioridad;
    }
  }

  const clienteIds = solicitudes
    .map((s) => s.cliente_id)
    .filter(Boolean);

  let clientes: any[] = [];

  if (clienteIds.length > 0) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .in("id", clienteIds);

    clientes = data || [];
  }

  return (
    <div className="flex min-h-screen bg-gray-100">

      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido}
        rol={perfil.rol}
      />

      <main className="ml-0 md:ml-64 flex-1 p-4 md:p-8 pt-20 md:pt-8">

        {/* Botón para volver atrás */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            ← Volver al panel
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Mis trabajos
          </h1>

          <p className="mt-2 text-sm md:text-base text-gray-600">
            Acá vas a encontrar los trabajos activos asignados ordenados por prioridad.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">
              Error al cargar los trabajos
            </p>

            <p className="mt-1 text-sm text-red-700">
              {error.message}
            </p>
          </div>
        )}

        {solicitudes.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow">

            <div className="text-5xl">
              🔧
            </div>

            <h2 className="mt-4 text-xl font-bold text-gray-800">
              No tenés trabajos pendientes
            </h2>

            <p className="mt-2 text-gray-500">
              Todos tus trabajos asignados ya fueron finalizados o no tenés nuevos encargos.
            </p>

          </div>
        ) : (

          <div className="space-y-5">

            {solicitudes.map((solicitud) => {

              const cliente = clientes.find(
                (c) => c.id === solicitud.cliente_id
              );

              return (
                <div
                  key={solicitud.id}
                  className="rounded-xl bg-white p-6 shadow"
                >

                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

                    <div>

                      <div className="mb-3 flex items-center gap-3 flex-wrap">

                        <span className="rounded-full bg-gray-900 px-3 py-1 text-sm font-bold text-white">
                          #{solicitud.numero}
                        </span>

                        <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                          {solicitud.estado}
                        </span>

                        {solicitud.prioridad !== 99 && (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
                            Prioridad #{solicitud.prioridad}
                          </span>
                        )}

                      </div>

                      <h2 className="text-xl font-bold text-gray-900">
                        {cliente?.nombre || "Cliente"}
                      </h2>

                      <div className="mt-3 space-y-1 text-sm text-gray-600">

                        <p>
                          📍 {solicitud.direccion}
                        </p>

                        <p>
                          📅 {solicitud.fecha}
                        </p>

                        <p>
                          🕐{" "}
                          {solicitud.horario_desde || "-"}
                          {" "}
                          {solicitud.horario_hasta
                            ? `- ${solicitud.horario_hasta}`
                            : ""}
                        </p>

                        <p>
                          🔧 {solicitud.tipo_visita}
                        </p>

                      </div>

                    </div>

                    <a
                      href={`/mis-trabajos/${solicitud.id}`}
                      className="rounded-lg bg-gray-900 px-6 py-3 text-center font-semibold text-white transition hover:bg-gray-700"
                    >
                      Ver trabajo
                    </a>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </main>
    </div>
  );
}