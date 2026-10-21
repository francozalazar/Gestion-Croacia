// Saldo de un pedido de fábrica calculado con la venta y sus pagos (la misma
// cuenta que usa Clientes). Si el pedido no tiene venta con total, devuelve null
// y la pantalla muestra el saldo escrito en el remito.
export type CuentaPedido = {
  total: number;
  pagado: number;
  saldo: number;
  saldado: boolean;
  // Fecha en que se cargó (created_at) el pago que completó el total.
  // null si no se puede determinar.
  fechaSaldado: string | null;
};

export function calcularCuenta(venta: any | null | undefined): CuentaPedido | null {
  if (!venta) return null;
  const total = Number(venta.total || 0);
  if (!(total > 0)) return null;
  const pagos = [...(venta.pagos || [])].sort((a: any, b: any) => {
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
    return ta - tb;
  });
  let acumulado = 0;
  let fechaSaldado: string | null = null;
  for (const p of pagos) {
    acumulado += Number(p.monto || 0);
    if (fechaSaldado === null && acumulado >= total - 0.5) {
      fechaSaldado = p.created_at || null;
    }
  }
  const saldo = total - acumulado;
  const saldado = saldo <= 0.5;
  return { total, pagado: acumulado, saldo: Math.max(saldo, 0), saldado, fechaSaldado: saldado ? fechaSaldado : null };
}

export function fechaCarga(iso: string | null) {
  if (!iso) return null;
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(iso));
}

export async function cargarCuentas(supabase: any, ids: number[]) {
  const mapa: Record<number, CuentaPedido | null> = {};
  if (ids.length === 0) return mapa;
  const { data } = await supabase
    .from("ventas")
    .select("solicitud_fabrica_id, total, pagos(monto, created_at)")
    .in("solicitud_fabrica_id", ids);
  (data || []).forEach((v: any) => {
    mapa[v.solicitud_fabrica_id] = calcularCuenta(v);
  });
  return mapa;
}
