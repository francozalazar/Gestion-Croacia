// Encabezado compartido de las cards de solicitudes (Coordinación y Encargado).
export default function CabeceraTarjeta({
  numero,
  etiqueta,
  esFabrica,
  urgente,
  sinAntiguedad,
  cliente,
  direccion,
  localidad,
}: {
  numero: string | number;
  etiqueta?: string | null;
  esFabrica?: boolean;
  urgente?: boolean;
  sinAntiguedad?: boolean;
  cliente?: string | null;
  direccion?: string | null;
  localidad?: string | null;
}) {
  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          #{numero}
        </span>
        <span
          className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
            esFabrica
              ? "bg-emerald-100 text-emerald-800"
              : "bg-blue-100 text-blue-800"
          }`}
        >
          {etiqueta}
        </span>
      </div>
      {urgente && <p className="mb-2 text-sm font-bold text-red-700">URGENTE</p>}
      {sinAntiguedad && <p className="mb-2 text-xs text-slate-500">Antigüedad sin registro</p>}
      <h3 className="line-clamp-1 text-lg font-bold text-slate-900">
        {cliente || "Cliente sin nombre"}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
        {direccion}
        {localidad ? ` - ${localidad}` : ""}
      </p>
    </>
  );
}
