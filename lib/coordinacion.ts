// Usa el tipo de visita guardado por Solicitudes. La prioridad 1-5 del
// recorrido es independiente: no convierte una visita normal en urgencia.
export function esUrgencia(s: { tipo_visita?: string | null }) {
  return (s.tipo_visita || "").trim().toLowerCase() === "urgencia";
}
function fechaCarga(s: { created_at?: string | null }) {
  const fecha = Date.parse(s.created_at || "");
  return Number.isFinite(fecha) ? fecha : Infinity;
}
export function compararCoordinacion(a: any, b: any) {
  return Number(esUrgencia(b)) - Number(esUrgencia(a)) ||
    fechaCarga(a) - fechaCarga(b) || String(a.id).localeCompare(String(b.id));
}
export function colorCoordinacion(s: any, ahora = Date.now()) {
  if (esUrgencia(s)) return "border-red-500 ring-1 ring-red-500 bg-red-50";
  return ahora - Date.parse(s.coordinacion_desde || "") > 48 * 60 * 60 * 1000
    ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white";
}
