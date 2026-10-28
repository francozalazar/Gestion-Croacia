export function rangoFinalizados(desde: string, hasta: string) {
  const valida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    new Date(`${s}T12:00:00Z`).toISOString().slice(0, 10) === s;
  if (!desde || !hasta) return null;
  try { if (!valida(desde) || !valida(hasta) || desde > hasta) return null; } catch { return null; }
  return { inicio: `${desde}T00:00:00-03:00`, fin: new Date(Date.parse(`${hasta}T00:00:00-03:00`) + 86400000).toISOString() };
}
