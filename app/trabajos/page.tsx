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

  // 1. Traemos las asignaciones del técnico ordenadas por prioridad
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
    const solicitudIds = asignaciones
      .map((a) => a.solicitud_id)
      .filter(Boolean);

    const solicitudFabricaIds = asignaciones
      .map((a) => a.solicitud_fabrica_id)
      .filter(Boolean);

    const [{ data: dataBase }, { data: dataFabrica }] =
      await Promise.all([
        solicitudIds.length
          ? supabase
              .from("solicitudes")
              .select("*")
              .in("id", solicitudIds)
          : Promise.resolve({ data: [] }),

        solicitudFabricaIds.length
          ? supabase
              .from("solicitudes_fabrica")
              .select("*")
              .in("id", solicitudFabricaIds)
          : Promise.resolve({ data: [] }),
      ]);

    const estadosOcultos = [
      "FINALIZADO",
      "PRESUPUESTADO",
      "LISTO_INSTALACION",
      "ANULADO",
    ];

    const listaBase = (dataBase || [])
      .filter((sol) => !estadosOcultos.includes(sol.estado))
      .map((sol) => {
        const asig = asignaciones.find(
          (a) => String(a.solicitud_id) === String(sol.id)
        );

        return {
          ...sol,
          origen: "solicitud",
          id_unico: `sol_${sol.id}`,
          numero_visible: sol.numero || sol.id,
          prioridad: asig?.prioridad ?? 99,
          fecha_asignada: asig?.fecha || sol.fecha,
        };
      });

    const listaFabrica = (dataFabrica || [])
      .filter((sol) => !estadosOcultos.includes(sol.estado))
      .map((sol) => {
        const asig = asignaciones.find(
          (a) =>
            String(a.solicitud_fabrica_id) === String(sol.id)
        );

        return {
          ...sol,
          origen: "fabrica",
          id_unico: `fab_${sol.id}`,
          numero_visible: sol.numero_remito || sol.numero || sol.id,
          prioridad: asig?.prioridad ?? 99,
          fecha_asignada: asig?.fecha || sol.fecha,
        };
      });

    const listaCombinada = [...listaBase, ...listaFabrica].sort(
      (a, b) => a.prioridad - b.prioridad
    );

    solicitudes = listaCombinada;
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

  // Helper para franja horaria compacta
  function obtenerEtiquetaFranja(desde?: string | null, hasta?: string | null) {
    if (!desde && !hasta) return "📅 Día completo (8:30 - 17:00 hs)";
    
    const hDesde = desde?.slice(0, 5) || "";
    const hHasta = hasta?.slice(0, 5) || "";

    if (
      ["08:00", "08:30", "09:00"].includes(hDesde) &&
      ["12:00", "12:30", "13:00"].includes(hHasta)
    ) {
      return "🌅 Mañana (8:30 - 12:30 hs)";
    }

    if (
      ["13:00", "13:30", "14:00"].includes(hDesde) &&
      ["17:00", "17:30", "18:00"].includes(hHasta)
    ) {
      return "☀️ Tarde (13:00 - 17:00 hs)";
    }

    return `🕐 ${desde || "08:30"} a ${hasta || "17:00"} hs`;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido}
        rol={perfil.rol}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 md:p-10 pt-20 md:pt-10">
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center text-xs font-semibold text-slate-500 transition hover:text-slate-900"
          >
            ← Volver al panel
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Mis trabajos pendientes
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            Trabajos activos ordenados según la prioridad asignada. Los finalizados ya no aparecen aquí.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800 text-xs">Error al cargar los trabajos</p>
            <p className="mt-1 text-xs text-red-700">{error.message}</p>
          </div>
        )}

        {solicitudes.length === 0 ? (
          <div className="rounded-2xl bg-white p-12 text-center shadow-xs border border-slate-100 max-w-md mx-auto">
            <div className="text-4xl mb-2">🎉</div>
            <h2 className="text-base font-bold text-slate-800">
              No tenés trabajos pendientes
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Has completado todas tus tareas asignadas o no hay nuevos encargos activos.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl">
            {solicitudes.map((solicitud) => {
              const cliente = clientes.find(
                (c) => c.id === solicitud.cliente_id
              );

              return (
                <div
                  key={solicitud.id_unico}
                  className="rounded-2xl bg-white p-5 shadow-xs border border-slate-200 flex flex-col justify-between transition hover:shadow-md hover:border-blue-400"
                >
                  <div>
                    {/* ENCABEZADO DE LA TARJETA */}
                    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                        #{solicitud.numero_visible}
                      </span>

                      {solicitud.prioridad !== 99 && (
                        <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-amber-100 text-amber-800">
                          Prioridad {solicitud.prioridad}
                        </span>
                      )}
                    </div>

                    {/* NOMBRE Y DIRECCIÓN */}
                    <h3 className="text-base font-bold text-slate-900 truncate">
                      {cliente?.nombre || solicitud.cliente_nombre || "Cliente sin nombre"}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 mt-1 uppercase truncate">
                      {solicitud.direccion || "-"} {solicitud.localidad ? `- ${solicitud.localidad}` : ""}
                    </p>

                    {/* DATOS DE FECHA Y HORARIO */}
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
                      <p>
                        📅 <strong>Fecha:</strong>{" "}
                        {solicitud.fecha_asignada
                          ? new Date(`${solicitud.fecha_asignada}T12:00:00`).toLocaleDateString("es-AR")
                          : "A coordinar"}
                      </p>
                      <p className="text-slate-700 font-medium bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 inline-block">
                        {obtenerEtiquetaFranja(solicitud.horario_desde, solicitud.horario_hasta)}
                      </p>
                      <p>
                        🔧 <strong>Tipo:</strong> {solicitud.tipo_visita || "Instalación / Medición"}
                      </p>
                    </div>
                  </div>

                  {/* BOTÓN DE ACCIÓN */}
                  <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
                    <Link
                      href={`/trabajos/${solicitud.id}?origen=${solicitud.origen}`}
                      className="w-full rounded-xl bg-slate-900 py-2.5 text-center text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      Ver trabajo y completar →
                    </Link>
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