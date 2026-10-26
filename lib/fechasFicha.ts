// Fechas de la ficha. "YYYY-MM-DD" es una fecha civil (columna date): se muestra tal cual,
// sin convertir por zona horaria. Un timestamp real se muestra en hora de Buenos Aires.
const ZONA = "America/Argentina/Buenos_Aires";
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export function fechaLinda(fecha: string | null | undefined) {
  if (!fecha) return null;
  const civil = SOLO_FECHA.exec(String(fecha).trim());
  if (civil) return `${civil[3]}/${civil[2]}/${civil[1]}`;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: ZONA });
}

export function fechaHoraLinda(fecha: string | null | undefined) {
  if (!fecha) return null;
  if (SOLO_FECHA.test(String(fecha).trim())) return fechaLinda(fecha);
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  const hora = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ZONA });
  return `${fechaLinda(fecha)} ${hora}`;
}
