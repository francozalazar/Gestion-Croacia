import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { FormularioModelo } from "./StockForms";
import StockVista from "@/components/StockVista";
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


  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido || ""}
        rol={perfil.rol}
      />

      <main className="ml-0 md:ml-64 min-h-screen p-4 md:p-8 pt-20 md:pt-8">
        <StockVista motores={motores} pedidos={pedidos} error={!!eMotores} volverHref="/dashboard">
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
        </StockVista>
      </main>
    </div>
  );
}
