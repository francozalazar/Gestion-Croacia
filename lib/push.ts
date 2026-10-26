import "server-only";
import { createClient } from "@supabase/supabase-js";

export function pushAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Push no configurado");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export function pushDisponible() {
  return Boolean(process.env.PUSH_ENABLED === "true" && process.env.PUSH_VAPID_PUBLIC_KEY && process.env.PUSH_VAPID_PRIVATE_KEY && process.env.PUSH_DISPATCH_SECRET);
}
export function endpointPermitido(endpoint: string) {
  try {
    const url = new URL(endpoint);
    // Android Chrome/Firefox: no aceptar destinos arbitrarios ni redes locales.
    return url.protocol === "https:" && !url.username && !url.password && !url.port &&
      ["fcm.googleapis.com", "updates.push.services.mozilla.com"].includes(url.hostname);
  } catch { return false; }
}
