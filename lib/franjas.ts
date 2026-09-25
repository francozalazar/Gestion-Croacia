// Franjas horarias canónicas usadas en toda la app.
// Misma convención que Nueva solicitud y Coordinación:
// Mañana 8:30-12:30 / Tarde 13:00-17:00 / Día completo 8:30-17:00.

export function textoFranja(
  desde?: string | null,
  hasta?: string | null
): string {
  if (!desde && !hasta) return "Día completo (8:30 - 17:00 hs)";

  const hDesde = (desde || "").slice(0, 5);
  const hHasta = (hasta || "").slice(0, 5);

  const esManana = ["08:00", "08:30", "09:00"].includes(hDesde);
  const esMediodia = ["12:00", "12:30", "13:00"].includes(hHasta);
  const esTarde = ["13:00", "13:30", "14:00"].includes(hDesde);
  const esCierre = ["17:00", "17:30", "18:00"].includes(hHasta);

  if (esManana && esMediodia) return "Mañana (8:30 - 12:30 hs)";
  if (esTarde && esCierre) return "Tarde (13:00 - 17:00 hs)";
  if (esManana && esCierre) return "Día completo (8:30 - 17:00 hs)";

  return `Horario: ${hDesde || "8:30"} a ${hHasta || "17:00"} hs`;
}

export function textoFranjaConEmoji(
  desde?: string | null,
  hasta?: string | null
): string {
  const t = textoFranja(desde, hasta);
  if (t.startsWith("Mañana")) return `🌅 ${t}`;
  if (t.startsWith("Tarde")) return `☀️ ${t}`;
  if (t.startsWith("Día completo")) return `📅 ${t}`;
  return `🕐 ${t}`;
}
