import ProduccionLista from "@/app/produccion/ProduccionLista";

// Pantalla "Producción". La misma para todos los roles; cambian los datos y
// quién puede cambiar estados (rol ADMIN, o la función onCambiarEstado).
export default function ProduccionVista({
  trabajos,
  rol,
  onCambiarEstado,
  verFicha = true,
}: {
  trabajos: any[];
  rol: string;
  onCambiarEstado?: (id: number, estado: string) => void | Promise<void>;
  verFicha?: boolean;
}) {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Producción</h1>
        <p className="mt-1 text-sm text-slate-500">
          Estado de los trabajos enviados a fábrica.
        </p>
      </div>

      {!trabajos?.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No hay trabajos de fábrica.
        </div>
      ) : (
        <ProduccionLista trabajos={trabajos} rol={rol} onCambiarEstado={onCambiarEstado} verFicha={verFicha} />
      )}
    </div>
  );
}
