// Un mismo cambio de estado de un pedido de fabrica con visita vinculada dispara dos triggers:
// uno en solicitudes_fabrica (guarda solo solicitud_fabrica_id) y otro en solicitudes (guarda
// solicitud_id y solicitud_fabrica_id). Se ve como dos renglones del mismo hecho.
// Solo se oculta el renglon sin solicitud_id cuando hay evidencia de origen dual y vinculo:
// ids consecutivos (<=2), mismo pedido, mismo responsable, misma etapa y <=2 s de diferencia.
// Ventas y pagos nunca se ocultan. Los datos originales no se tocan.
const normEtapa = (t: any) =>
  String(t || "").replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function unirParesTrigger<T extends Record<string, any>>(entrada: T[]): T[] {
  const eventos = entrada
    .map((e) => ({ ...e }))
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
        Number(a.id) - Number(b.id)
    );
  const ocultos = new Set<any>();
  for (const a of eventos) {
    if (!a.solicitud_id || !a.solicitud_fabrica_id || a.venta_id) continue;
    const dup = eventos.find(
      (b) =>
        b !== a && !ocultos.has(b) && !b.solicitud_id && !b.venta_id &&
        b.solicitud_fabrica_id === a.solicitud_fabrica_id &&
        (b.responsable || null) === (a.responsable || null) &&
        normEtapa(b.etapa) === normEtapa(a.etapa) &&
        Math.abs(new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) <= 2000 &&
        Math.abs(Number(b.id) - Number(a.id)) <= 2
    );
    if (dup) {
      ocultos.add(dup);
      if (String(dup.etapa).length > String(a.etapa).length) (a as any).etapa = dup.etapa;
    }
  }
  return eventos.filter((e) => !ocultos.has(e));
}
