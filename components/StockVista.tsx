import Link from "next/link";
import { Package, ArrowLeft } from "lucide-react";
import { CardStockMotor, type AccionesStock } from "@/app/stock/StockForms";

type Motor = { id: number; nombre: string; cantidad: number; minimo: number };

// Pantalla "Stock de motores". La misma para todos los roles. Lo que sigue a las
// tarjetas (carga por técnico, alta de modelos, movimientos) llega como children.
export default function StockVista({
  motores,
  pedidos,
  error,
  volverHref,
  acciones,
  children,
}: {
  motores: Motor[];
  pedidos: { id: number; cliente_nombre: string | null }[];
  error?: boolean;
  volverHref: string;
  acciones?: AccionesStock;
  children?: React.ReactNode;
}) {
  return (
    <>
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
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500">Administración</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Stock de motores
              </h1>
            </div>
          </div>
          <p className="mt-2 text-sm text-slate-600">
            Cada modelo se cuenta por separado. Sumá cuando llegan motores y descontá cuando se usa uno en un trabajo.
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            No se pudo cargar el stock. Si es la primera vez, falta aplicar la tabla en la base.
          </div>
        )}

        {/* MODELOS */}
        <div className="mb-8">
          {motores.length === 0 && !error && (
            <div className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow-sm">
              Todavía no hay modelos cargados. Agregá el primero abajo con el conteo inicial.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {motores.map((m) => (
              <CardStockMotor key={m.id} motor={m} pedidos={pedidos} acciones={acciones} />
            ))}
          </div>
        </div>

        {children}
    </>
  );
}
