import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { endpointPermitido, pushAdmin, pushDisponible } from "@/lib/push";

export const runtime = "nodejs";
async function tecnico() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client.from("profiles").select("rol, activo").eq("id", user.id).single();
  return data?.rol?.toUpperCase() === "TECNICO" && data.activo === true ? user : null;
}
export async function GET() {
  if (!await tecnico()) return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  return NextResponse.json({ disponible: pushDisponible(), publicKey: pushDisponible() ? process.env.PUSH_VAPID_PUBLIC_KEY : null }, { headers: { "Cache-Control": "no-store" } });
}
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const user = await tecnico();
  if (!user) return new NextResponse(null, { status: 403 });
  if (!pushDisponible()) return NextResponse.json({ error: "Los avisos todavía no están disponibles." }, { status: 503 });
  if (Number(req.headers.get("content-length")) > 8192) return new NextResponse(null, { status: 413 });
  let sub;
  try { const raw = await req.text(); if (raw.length > 8192) return new NextResponse(null, { status: 413 }); sub = JSON.parse(raw); } catch { return new NextResponse(null, { status: 400 }); }
  if (!endpointPermitido(sub?.endpoint) || !/^[A-Za-z0-9_-]{80,100}$/.test(sub?.keys?.p256dh || "") || !/^[A-Za-z0-9_-]{20,30}$/.test(sub?.keys?.auth || "")) return new NextResponse(null, { status: 400 });
  const { error } = await pushAdmin().from("push_suscripciones").upsert({ endpoint: sub.endpoint, usuario_id: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, updated_at: new Date().toISOString() }, { onConflict: "endpoint" });
  return NextResponse.json(error ? { error: "No se pudo activar el aviso. Probá de nuevo." } : { ok: true }, { status: error ? 500 : 200 });
}
export async function DELETE(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return new NextResponse(null, { status: 403 });
  const user = await tecnico();
  if (!user) return new NextResponse(null, { status: 403 });
  let endpoint;
  try { endpoint = (await req.json()).endpoint; } catch { return new NextResponse(null, { status: 400 }); }
  const { error } = await pushAdmin().from("push_suscripciones").delete().eq("endpoint", endpoint).eq("usuario_id", user.id);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
