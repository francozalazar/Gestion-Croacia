import { Factory, ArrowLeft } from "lucide-react";
import Link from "next/link";
import EnviarACoordinacion, { VerDetallesInstalacion } from "@/components/EnviarACoordinacion";

// Pantalla "Instalación": pedidos terminados por fábrica. La misma para todos
// los roles; el encargado la ve en sólo lectura (soloLectura).
export default function ListosVista({
  solicitudes,
  error,
  nombresCreadores,
  soloLectura = false,
  volverHref,
}: {
  solicitudes: any[] | null;
  error?: boolean;
  nombresCreadores: Record<string, string>;
  soloLectura?: boolean;
  volverHref: string;
}) {
  return (
    <>
        {/* BOTÓN PARA VOLVER ATRÁS */}
        <div className="mb-6">
          <Link
            href={volverHref}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Volver al inicio
          </Link>
        </div>

        {/* ENCABEZADO */}
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Factory size={24} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Producción terminada
              </p>

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Instalación
              </h1>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Error al cargar los trabajos.
          </div>
        )}

        {!error &&
          (!solicitudes || solicitudes.length === 0) && (
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
              <Factory
                size={48}
                className="mx-auto text-slate-300"
              />

              <h2 className="mt-4 text-lg font-bold text-slate-900">
                No hay trabajos en Instalación
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Cuando fábrica termine un trabajo, aparecerá aquí.
              </p>
            </div>
          )}

        {solicitudes && solicitudes.length > 0 && (
          <>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="hidden grid-cols-[90px_1.2fr_1.4fr_110px_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Dirección</span>
              <span>Fecha</span>
              <span className="text-right">Acción</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {solicitudes.map((solicitud) => (
                <li
                  key={solicitud.id}
                  className="grid gap-2 px-5 py-4 text-sm lg:grid-cols-[90px_1.2fr_1.4fr_110px_auto] lg:items-center lg:gap-4"
                >
                  <span className="font-bold text-slate-900">
                    <span className="lg:hidden text-xs font-medium text-slate-400">Pedido </span>
                    #{solicitud.numero_remito}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-slate-800">
                      {solicitud.cliente_nombre || "-"}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                      {solicitud.tipo_visita || "Sin tipo especificado"}
                      {solicitud.cliente_telefono ? ` - ${solicitud.cliente_telefono}` : ""}
                    </p>
                    <p className="break-words text-xs text-slate-500">
                      Cargado por: {nombresCreadores[solicitud.creado_por] || "Sin dato"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="break-words text-slate-700">
                      {solicitud.direccion || "-"}
                      {solicitud.localidad ? ` - ${solicitud.localidad}` : ""}
                    </p>
                    {solicitud.observaciones && (
                      <p className="line-clamp-2 text-xs text-slate-500">
                        {solicitud.observaciones}
                      </p>
                    )}
                  </div>
                  <span className="text-slate-700">
                    <span className="lg:hidden text-xs text-slate-400">Fecha solicitada: </span>
                    {solicitud.fecha
                      ? new Date(`${solicitud.fecha}T12:00:00`).toLocaleDateString("es-AR")
                      : "-"}
                  </span>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <VerDetallesInstalacion observaciones={solicitud.observaciones} />
                    {!soloLectura && <EnviarACoordinacion solicitud={solicitud} />}
                  </div>
                </li>
              ))}
            </ul>
          </div>
</>
        )}
    </>
  );
}
