export type MovimientoVista = {
  id: number;
  tipo: string;
  cantidad: number;
  modelo: string;
  tecnico: string; // "" si el movimiento no guardo tecnico
  trabajo: string; // "#remito Cliente" o ""
  detalle: string | null;
  fecha: string;
  cargadoPor: string;
};

export default function MovimientosLista({ movimientos }: { movimientos: MovimientoVista[] }) {
  if (movimientos.length === 0) {
    return <p className="text-sm text-slate-600">Todavía no hay movimientos cargados.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {movimientos.map((mov) => (
        <li key={mov.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex w-16 justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                mov.tipo === "SALIDA"
                  ? "bg-amber-100 text-amber-800"
                  : mov.tipo === "ENTRADA"
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-200 text-slate-700"
              }`}
            >
              {mov.tipo === "SALIDA" ? `-${mov.cantidad}` : `+${mov.cantidad}`}
            </span>
            <div>
              <p className="font-medium text-slate-900">
                {mov.modelo}
                {mov.tipo === "INICIAL" && (
                  <span className="ml-2 text-xs font-normal text-slate-500">(stock inicial)</span>
                )}
              </p>
              <p className="text-xs text-slate-500">
                {mov.tipo === "SALIDA" ? (
                  <>
                    Técnico: {mov.tecnico || "Sin técnico registrado"} · Trabajo:{" "}
                    {mov.trabajo || mov.detalle || "Sin trabajo registrado"}
                  </>
                ) : (
                  mov.detalle || "Sin detalle"
                )}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            {mov.fecha}
            {mov.cargadoPor && ` · Cargó: ${mov.cargadoPor}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
