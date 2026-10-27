import { createClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";

// Apagada salvo que exista COPIA_COMPLETA_TOKEN_SHA256 (hash, no la clave) en el servidor.
// Credencial propia, distinta de la de remitos PDF: ninguna sirve para la otra ruta.
export function accesoCompleta(request: Request) {
  if (new URL(request.url).hostname !== "gestion-croacia.vercel.app") return null;
  const hash = process.env.COPIA_COMPLETA_TOKEN_SHA256 || "";
  if (!/^[a-f0-9]{64}$/.test(hash)) return null;
  const token = request.headers.get("authorization")?.match(/^Bearer ([A-Za-z0-9_-]{43,128})$/)?.[1];
  if (!token) return null;
  const recibido = createHash("sha256").update(token).digest();
  if (!timingSafeEqual(recibido, Buffer.from(hash, "hex"))) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Copia no configurada");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function rutaValida(bucket: string, ruta: string) {
  return /^[a-z0-9_-]{1,63}$/.test(bucket) && ruta.length > 0 && ruta.length <= 1024 &&
    !ruta.startsWith("/") && !ruta.split("/").some(p => p === ".." || p === "." || p === "");
}
export function entero(valor: string | null, min: number, max: number) {
  if (!valor || !/^\d{1,15}$/.test(valor)) return null;
  const n = Number(valor);
  return n >= min && n <= max ? n : null;
}
export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
