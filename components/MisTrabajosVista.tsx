import { textoFranjaConEmoji as obtenerEtiquetaFranja } from "@/lib/franjas";
import Link from "next/link";

// Pantalla "Mi recorrido" / "Mis trabajos pendientes". La misma para técnico y
// encargado: cambia de dónde vienen los datos y a qué ruta lleva "Ver trabajo".
export default function MisTrabajosVista({
  solicitudes,
  clientes,
  error,
  volverHref,
  rutaTrabajo,
}: {
  solicitudes: any[];
  clientes: any[];
  error?: string | null;
  volverHref: string;
  rutaTrabajo: string;
}) {
  return (
    <>
        <div className="mb-6">
          <Link
            href={volverHref}
            className="inline-flex items-center text-xs font-semibold text-slate-500 transition hover:text-slate-900"
          >
            ← Volver al panel
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Mis trabajos pendientes
          </h1>
          <p className="mt-1 text-xs md:text-sm text-slate-500">
            Trabajos activos ordenados según la prioridad asignada. Los finalizados ya no aparecen aquí.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800 text-xs">Error al cargar los trabajos</p>
            <p className="mt-1 text-xs text-red-700">{error}</p>
          </div>
        )}

        {solicitudes.length === 0 ? (
          <div className="rounded-xl bg-white p-12 text-center shadow-sm border border-slate-100 max-w-md mx-auto">
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
                  className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 flex flex-col justify-between transition hover:shadow-md hover:border-blue-400"
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
                      href={`${rutaTrabajo}/${solicitud.id}?origen=${solicitud.origen}`}
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
    </>
  );
}
