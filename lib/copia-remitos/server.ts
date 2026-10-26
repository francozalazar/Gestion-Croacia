import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";

export const TIPOS = ["visita", "fabrica"] as const;
export type Tipo = typeof TIPOS[number];
// Deliberadamente apagado hasta configurar hash, tipos y fecha en el servidor.
// No acepta la clave de Supabase como credencial del programa.
export function acceso(request: Request) {
  const hash = process.env.COPIA_REMITOS_TOKEN_SHA256 || "";
  const tipos = (process.env.COPIA_REMITOS_TIPOS || "").split(",");
  const desde = process.env.COPIA_REMITOS_DESDE || "";
  if (!/^[a-f0-9]{64}$/.test(hash) || !/^\d{4}-\d{2}-\d{2}$/.test(desde) ||
      tipos.length === 0 || tipos.some(t => !TIPOS.includes(t as Tipo))) return null;
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1];
  if (!token) return null;
  const recibido = createHash("sha256").update(token).digest();
  if (!timingSafeEqual(recibido, Buffer.from(hash, "hex"))) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Copia no configurada");
  return { db: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), tipos, desde };
}
export function fechaDocumento(tipo: Tipo, row: Record<string, any>) {
  const value = tipo === "visita" ? row.fecha_finalizacion : row.fecha;
  if (!value) return "sin-fecha";
  if (tipo === "visita") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "sin-fecha";
    return new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
  }
  const date = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : "sin-fecha";
}
export function emitido(tipo: Tipo, row: Record<string, any>, desde: string) {
  const fecha = fechaDocumento(tipo, row);
  return (fecha === "sin-fecha" ? desde === "0001-01-01" : fecha >= desde) &&
    (tipo === "visita" ? !!row.fecha_finalizacion : (!!String(row.observaciones || "").trim() || !!row.fecha_finalizado));
}
// Incluye toda la fila para detectar cualquier edición, incluso si no cambia el PDF.
export function revision(row: Record<string, any>, tecnico: string) {
  const ordenada = Object.keys(row).sort().map(k => [k, row[k]]);
  return createHash("sha256").update(JSON.stringify(["pdf-v1", ordenada, tecnico])).digest("hex");
}
export async function tecnicoActual(db: any, row: Record<string, any>) {
  if (String(row.tecnico_remito || "").trim()) return String(row.tecnico_remito).trim();
  const { data, error } = await db.from("asignaciones").select("usuario_id, tipo").eq("solicitud_id", row.id).maybeSingle();
  if (error) throw new Error("No se pudo leer la asignación");
  if (!data?.usuario_id) return "-";
  const { data: p, error: err } = await db.from("profiles").select("nombre, apellido").eq("id", data.usuario_id).single();
  if (err) throw new Error("No se pudo leer el técnico");
  return `${p?.nombre || ""} ${p?.apellido || ""}`.trim() || "-";
}
export function respuesta(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
