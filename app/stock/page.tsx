import { redirect } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { Package, ArrowLeft } from "lucide-react";
import { FormularioModelo, CardStockMotor } from "./StockForms";
import CargaPorTecnico from "./CargaPorTecnico";
import MovimientosLista from "./MovimientosLista";

type Motor = {
  id: number;
  nombre: string;
  cantidad: number;
  minimo: number;
};

type PerfilLite = { id: string; nombre: string | null; apellido: string | null };

type PedidoLite = { id: number; cliente_nombre: string | null };

type Movimiento = {
  id: number;
  motor_id: number;
  tipo: string;
  cantidad: number;
  detalle: string | null;
  solicitud_fabrica_id: number | null;
  solicitud_id: number | null;
  tecnico_id: string | null;
  creado_por: string | null;
  created_at: string;
};

const ESTADOS_PEDIDO_ACTIVOS = [
  "PENDIENTE_APROBACION",
  "ENVIADO_A_CORTAR",
  "EN_CORTE",
  "EN_FABRICACION",
  "EN_FABRICA",
  "FALTANTES",
  "LISTO_PARA_COLOCAR",
];

function fmtFecha(iso: string) {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const porAgotarse = (m: Motor) => m.cantidad <= m.minimo;

export default async function StockPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();
  if (!perfil) redirect("/");

  const rol = String(perfil.rol || "").toUpperCase();
  if (rol !== "ADMIN") redirect("/dashboard");

  const [
    { data: motoresData, error: eMotores },
    { data: movimientosData },
    { data: pedidosData },
    { data: perfiles },
    { data: tecnicosData },
  ] = await Promise.all([
    supabase.from("stock_motores").select("id, nombre, cantidad, minimo").order("nombre"),
    supabase
      .from("stock_movimientos")
      .select("id, motor_id, tipo, cantidad, detalle, solicitud_fabrica_id, solicitud_id, tecnico_id, creado_por, created_at")
      .order("id", { ascending: false })
      .limit(30),
    supabase
      .from("solicitudes_fabrica")
      .select("id, cliente_nombre")
      .in("estado", ESTADOS_PEDIDO_ACTIVOS)
      .order("id", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, nombre, apellido"),
    supabase.from("profiles").select("id, nombre, apellido").in("rol", ["TECNICO", "ENCARGADO"]).eq("activo", true).order("nombre"),
  ]);

  // Trabajo y tecnico de cada movimiento: se leen aparte para mostrar remito, cliente y tecnico.
  const movsIni: Movimiento[] = movimientosData || [];
  const idsFab = [...new Set(movsIni.map((m) => m.solicitud_fabrica_id).filter(Boolean))] as number[];
  const idsSol = [...new Set(movsIni.map((m) => m.solicitud_id).filter(Boolean))] as number[];
  const [{ data: fabMov }, { data: solMov }] = await Promise.all([
    idsFab.length ? supabase.from("solicitudes_fabrica").select("id, numero_remito, cliente_nombre").in("id", idsFab) : Promise.resolve({ data: [] as any[] }),
    idsSol.length ? supabase.from("solicitudes").select("id, numero, cliente_nombre").in("id", idsSol) : Promise.resolve({ data: [] as any[] }),
  ]);

  const motores: Motor[] = motoresData || [];
  const movimientos: Movimiento[] = movimientosData || [];
  const pedidos = pedidosData || [];

  const listaPerfiles: PerfilLite[] = perfiles || [];
  const listaPedidos: PedidoLite[] = pedidos;

  const nombreDe = (id: string | null) => {
    const p = listaPerfiles.find((x) => x.id === id);
    return p ? `${p.nombre || ""} ${p.apellido || ""}`.trim() : "";
  };
  const motorDe = (id: number) => motores.find((m) => m.id === id)?.nombre || "—";
  // Trabajo (remito + cliente) de un movimiento.
  const trabajoDe = (mov: Movimiento) => {
    if (mov.solicitud_fabrica_id) {
      const f = (fabMov || []).find((x: any) => x.id === mov.solicitud_fabrica_id);
      return `#${f?.numero_remito || mov.solicitud_fabrica_id} ${f?.cliente_nombre || ""}`.trim();
    }
    if (mov.solicitud_id) {
      const f = (solMov || []).find((x: any) => x.id === mov.solicitud_id);
      return `#${f?.numero || mov.solicitud_id} ${f?.cliente_nombre || ""}`.trim();
    }
    return "";
  };
  // Solo el tecnico guardado al cargar el movimiento. Los movimientos anteriores no lo guardaron y
  // no se reconstruye desde la asignacion actual (el trabajo pudo reasignarse).
  const tecnicoDe = (mov: Movimiento) => (mov.tecnico_id ? nombreDe(mov.tecnico_id) : "");

  const unidadesTotales = motores.reduce((acc, m) => acc + m.cantidad, 0);
  const enMinimo = motores.filter(porAgotarse).length;

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido || ""}
        rol={perfil.rol}
      />

      <main className="ml-0 md:ml-64 min-h-screen p-4 md:p-8 pt-20 md:pt-8">
        <div className="mb-6">
          <Link
            href="/dashboard"
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

        {/* RESUMEN */}
        <div className="mb-8 grid grid-cols-3 gap-3 md:gap-5">
          <div className="rounded-xl bg-white p-3 shadow-sm md:p-5">
            <p className="text-xs text-slate-500 md:text-sm">Modelos</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 md:mt-2 md:text-3xl">{motores.length}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm md:p-5">
            <p className="text-xs text-slate-500 md:text-sm">Unidades en total</p>
            <p className="mt-1 text-2xl font-bold text-blue-600 md:mt-2 md:text-3xl">{unidadesTotales}</p>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm md:p-5">
            <p className="text-xs text-slate-500 md:text-sm">Por agotarse</p>
            <p className={`mt-1 text-2xl font-bold md:mt-2 md:text-3xl ${enMinimo > 0 ? "text-red-600" : "text-slate-900"}`}>
              {enMinimo}
            </p>
          </div>
        </div>

        {eMotores && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            No se pudo cargar el stock. Si es la primera vez, falta aplicar la tabla en la base.
          </div>
        )}

        {/* MODELOS */}
        <div className="mb-8">
          {motores.length === 0 && !eMotores && (
            <div className="rounded-xl bg-white p-6 text-sm text-slate-600 shadow-sm">
              Todavía no hay modelos cargados. Agregá el primero abajo con el conteo inicial.
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {motores.map((m) => (
              <CardStockMotor key={m.id} motor={m} pedidos={pedidos} />
            ))}
          </div>
        </div>

        {/* CARGA POR TECNICO */}
        <CargaPorTecnico tecnicos={tecnicosData || []} motores={motores} />

        {/* NUEVO MODELO */}
        <div className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Agregar modelo</h2>
          <FormularioModelo />
        </div>

        {/* MOVIMIENTOS */}
        <div className="rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">Últimos movimientos</h2>
          <MovimientosLista
            movimientos={movimientos.map((mov) => ({
              id: mov.id,
              tipo: mov.tipo,
              cantidad: mov.cantidad,
              modelo: motorDe(mov.motor_id),
              tecnico: tecnicoDe(mov),
              trabajo: trabajoDe(mov),
              detalle: mov.detalle,
              fecha: fmtFecha(mov.created_at),
              cargadoPor: nombreDe(mov.creado_por),
            }))}
          />
        </div>
      </main>
    </div>
  );
}
