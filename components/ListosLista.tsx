import EnviarACoordinacion from "@/components/EnviarACoordinacion";

// Lista de pedidos terminados por fabrica, listos para coordinar la instalacion.
export default function ListosLista({ solicitudes }: { solicitudes: any[] }) {
  return (
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
                  <div className="lg:text-right">
                    <EnviarACoordinacion solicitud={solicitud} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
  );
}
