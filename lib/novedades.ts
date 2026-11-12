import { avisoAsignacionVendedor } from "@/lib/avisosVendedor";
import { requierePrecio } from "@/lib/tipoVisita";

export type Novedad = {
  id: string;
  titulo: string;
  detalle: string;
  fecha: string;
  link: string;
};

const num5 = (n: any) => String(n).padStart(5, "0");

// Trabajos que entraron a Coordinación y esperan fecha y técnico.
async function trabajosParaCoordinar(supabase: any, link: string): Promise<Novedad[]> {
  const { data } = await supabase
    .from("solicitudes")
    .select("id,numero,cliente_nombre,direccion,created_at,updated_at")
    .eq("estado", "PENDIENTE_COORDINACION")
    .order("updated_at", { ascending: false })
    .limit(10);
  return (data || []).map((s: any) => ({
    id: `coordinar-${s.id}`,
    titulo: `Trabajo nuevo para coordinar #${num5(s.numero || s.id)}`,
    detalle: `${s.cliente_nombre || "Cliente"} - ${s.direccion || "Sin dirección"}`,
    fecha: s.updated_at || s.created_at,
    link,
  }));
}

// Novedades de la campanita: las mismas que ya muestra Inicio, según el rol del
// usuario. RLS sigue vigente: cada usuario sólo ve lo que ya podía ver.
export async function cargarNovedades(supabase: any, userId: string, rol: string): Promise<Novedad[]> {
  const R = (rol || "").toUpperCase();
  const out: Novedad[] = [];

  if (R === "FABRICA") {
    const { data } = await supabase
      .from("solicitudes_fabrica")
      .select("id,numero_remito,cliente_nombre,created_at")
      .in("estado", ["ENVIADO_A_CORTAR", "EN_CORTE", "EN_FABRICACION", "EN_FABRICA", "FALTANTES"])
      .order("created_at", { ascending: false })
      .limit(10);
    for (const t of data || []) {
      out.push({
        id: `fabrica-${t.id}`,
        titulo: "Te asignaron un trabajo nuevo",
        detalle: `Pedido #${t.numero_remito || t.id} - ${t.cliente_nombre || "Cliente sin nombre"}`,
        fecha: t.created_at,
        link: "/fabrica",
      });
    }
  } else if (R === "TECNICO") {
    const { data: asig } = await supabase
      .from("asignaciones")
      .select("id,solicitud_id,solicitud_fabrica_id,created_at")
      .eq("usuario_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    const lista = asig || [];
    const ids = lista.map((a: any) => a.solicitud_id).filter(Boolean);
    const idsF = lista.map((a: any) => a.solicitud_fabrica_id).filter(Boolean);
    const [v, f] = await Promise.all([
      ids.length ? supabase.from("solicitudes").select("*").in("id", ids) : { data: [] },
      idsF.length ? supabase.from("solicitudes_fabrica").select("*").in("id", idsF) : { data: [] },
    ]);
    for (const a of lista) {
      const t = a.solicitud_fabrica_id
        ? (f.data || []).find((x: any) => x.id === a.solicitud_fabrica_id)
        : (v.data || []).find((x: any) => x.id === a.solicitud_id);
      if (!t || t.fecha_finalizacion || ["FINALIZADO", "ANULADO", "CANCELADO"].includes(t.estado)) continue;
      out.push({
        id: `tec-${a.id}`,
        titulo: "Se te asignó un nuevo trabajo",
        detalle: `Cliente: ${t.cliente_nombre || "Sin nombre"} | ${t.direccion || "Sin dirección"}`,
        fecha: a.created_at || t.updated_at || t.created_at,
        link: "/trabajos",
      });
    }
  } else if (R === "ENCARGADO") {
    out.push(...(await trabajosParaCoordinar(supabase, `/encargado?seccion=${encodeURIComponent("Coordinación")}`)));
  } else if (["ADMIN", "OFICINA", "COORDINACION"].includes(R)) {
    if (R !== "OFICINA") out.push(...(await trabajosParaCoordinar(supabase, "/coordinacion")));
    let q = supabase
      .from("solicitudes")
      .select("*")
      .in("estado", ["PRESUPUESTADO", "FINALIZADO"])
      .order("updated_at", { ascending: false })
      .limit(20);
    if (R === "OFICINA") q = q.eq("creado_por", userId);
    const { data: sol } = await q;
    for (const s of sol || []) {
      if (s.estado === "PRESUPUESTADO" && requierePrecio(s.tipo_visita)) {
        out.push({
          id: `presupuesto-${s.id}`,
          titulo: `Le asignaron precio al trabajo #${num5(s.numero || s.id)}`,
          detalle: `Cliente: ${s.cliente_nombre || "Cliente"} - Monto: $${(s.subtotal || s.precio || 0).toLocaleString("es-AR")}`,
          fecha: s.updated_at || s.created_at,
          link: "/presupuestos",
        });
      } else if (s.estado === "FINALIZADO") {
        out.push({
          id: `finalizado-${s.id}`,
          titulo: `Trabajo finalizado #${num5(s.numero || s.id)}`,
          detalle: `El técnico completó la visita en ${s.direccion || "la dirección cargada"}`,
          fecha: s.updated_at || s.created_at,
          link: "/visitas-finalizadas",
        });
      }
    }

    if (R === "ADMIN") {
      const { data } = await supabase
        .from("solicitudes_fabrica")
        .select("*, creador:profiles!creado_por(nombre, apellido)")
        .eq("estado", "PENDIENTE_APROBACION")
        .order("created_at", { ascending: false })
        .limit(10);
      for (const t of data || []) {
        const quien = t.creador ? `${t.creador.nombre} ${t.creador.apellido || ""}`.trim() : "Oficina";
        out.push({
          id: `aprobacion-${t.id}`,
          titulo: "Se cargó un nuevo trabajo para aprobar",
          detalle: `Pedido #${t.numero_remito || t.id} - ${t.cliente_nombre || "Cliente"} (lo cargó ${quien})`,
          fecha: t.created_at,
          link: "/aprobacion-fabrica",
        });
      }
    }

    if (R === "OFICINA") {
      const { data: av } = await supabase
        .from("avisos_circuito")
        .select("id,tipo,solicitud_fabrica_id,created_at")
        .eq("usuario_id", userId)
        .in("tipo", ["fabrica_aprobada", "fabrica_lista"])
        .order("created_at", { ascending: false })
        .limit(10);
      // Cliente y número de remito del pedido (solo los que este usuario puede ver).
      const idsPedido = Array.from(new Set((av || []).map((a: any) => a.solicitud_fabrica_id).filter(Boolean)));
      const { data: pedidosAviso } = idsPedido.length
        ? await supabase.from("solicitudes_fabrica").select("id,numero_remito,cliente_nombre").in("id", idsPedido)
        : { data: [] };
      for (const a of av || []) {
        const p = (pedidosAviso || []).find((x: any) => x.id === a.solicitud_fabrica_id);
        const ident = p ? [p.cliente_nombre, p.numero_remito ? `Remito #${p.numero_remito}` : ""].filter(Boolean).join(" - ") : "";
        out.push({
          id: `aviso-${a.id}`,
          titulo: a.tipo === "fabrica_lista" ? "Tu trabajo está listo para colocar" : "Tu trabajo de fábrica fue aprobado",
          detalle: [ident, a.tipo === "fabrica_lista" ? "Fábrica lo terminó y lo pasó a Instalación." : "El pedido fue aprobado y enviado a cortar."].filter(Boolean).join(" | "),
          fecha: a.created_at,
          link: `/ficha/remito/${a.solicitud_fabrica_id}`,
        });
      }

      const [visitas, pedidos, asignaciones, tecnicos] = await Promise.all([
        supabase.from("solicitudes").select("*").eq("creado_por", userId).in("estado", ["ASIGNADO", "EN_PROCESO"]),
        supabase.from("solicitudes_fabrica").select("*").eq("creado_por", userId).in("estado", ["ASIGNADO", "EN_PROCESO"]),
        supabase.from("asignaciones").select("*").eq("tipo", "TECNICO"),
        supabase.from("profiles").select("id,nombre,apellido").in("rol", ["TECNICO", "ENCARGADO"]),
      ]);
      if (![visitas, pedidos, asignaciones, tecnicos].some((r: any) => r.error)) {
        for (const a of asignaciones.data || []) {
          const pedido = a.solicitud_fabrica_id ? (pedidos.data || []).find((p: any) => p.id === a.solicitud_fabrica_id) : null;
          const visita = a.solicitud_id ? (visitas.data || []).find((x: any) => x.id === a.solicitud_id) : null;
          const n = avisoAsignacionVendedor(a, visita, pedido, userId, (tecnicos.data || []).find((t: any) => t.id === a.usuario_id));
          if (n) out.push(n);
        }
      }
    }
  }

  const vistos = new Set<string>();
  return out
    .filter((n) => n.fecha && !vistos.has(n.id) && vistos.add(n.id))
    .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
    .slice(0, 10);
}
