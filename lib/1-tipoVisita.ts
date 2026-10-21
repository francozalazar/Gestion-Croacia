// Regla unica: solo "Presupuesto" y "Urgencia" llevan precio.
// Todos los demas tipos de visita van sin precio (confirmado por Franco 21/10/2026).
export function normalizarTipoVisita(tipo: unknown): string {
  return String(tipo || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function requierePrecio(tipo: unknown): boolean {
  const t = normalizarTipoVisita(tipo);
  return t === "presupuesto" || t === "urgencia";
}
