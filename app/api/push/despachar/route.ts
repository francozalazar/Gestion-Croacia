import { NextRequest, NextResponse } from "next/server";
import { despacharAvisos } from "@/lib/despacharAvisos";
import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { endpointPermitido, pushAdmin, pushDisponible } from "@/lib/push";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: NextRequest) {
  const expected = process.env.PUSH_DISPATCH_SECRET;
  const supplied = req.headers.get("authorization") || "";
  if (!expected || Buffer.byteLength(supplied) !== Buffer.byteLength(`Bearer ${expected}`) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(`Bearer ${expected}`))) return new NextResponse(null, { status: 401 });
  if (!pushDisponible()) return new NextResponse(null, { status: 503 });
  webpush.setVapidDetails("https://gestion-croacia.vercel.app", process.env.PUSH_VAPID_PUBLIC_KEY!, process.env.PUSH_VAPID_PRIVATE_KEY!);
  const admin = pushAdmin();
  const { data: eventos, error } = await admin.rpc("push_reclamar");
  if (error) return new NextResponse(null, { status: 503 });
  for (const evento of eventos || []) {
    const vigente = async () => {
      const [{ data: a, error: errA }, { data: p, error: errP }] = await Promise.all([
        admin.from("asignaciones").select("usuario_id, tipo").eq("id", evento.asignacion_id).maybeSingle(),
        admin.from("profiles").select("rol, activo").eq("id", evento.usuario_id).maybeSingle(),
      ]);
      if (errA || errP) return null;
      return a?.usuario_id === evento.usuario_id && a?.tipo === "TECNICO" && p?.rol === "TECNICO" && p.activo === true;
    };
    const cerrar = () => admin.from("push_eventos").update({ procesado_at: new Date().toISOString() }).eq("id", evento.id);
    const estado = await vigente();
    if (estado === null) continue;
    if (!estado) { await cerrar(); continue; }
    const { data: subs, error: errSubs } = await admin.from("push_suscripciones").select("endpoint, p256dh, auth").eq("usuario_id", evento.usuario_id);
    if (errSubs) continue;
    let retry = false;
    for (const sub of subs || []) {
      const { data: enviada, error: errEstado } = await admin.from("push_entregas").select("enviado_at").eq("evento_id", evento.id).eq("endpoint", sub.endpoint).maybeSingle();
      if (errEstado) { retry = true; continue; }
      if (enviada?.enviado_at) continue;
      if (!endpointPermitido(sub.endpoint)) continue;
      const actual = await vigente();
      if (actual === null) { retry = true; continue; }
      if (!actual) continue;
      const { data: propietario, error: errProp } = await admin.from("push_suscripciones").select("usuario_id").eq("endpoint", sub.endpoint).maybeSingle();
      if (errProp) { retry = true; continue; }
      if (propietario?.usuario_id !== evento.usuario_id) continue;
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ tipo: "trabajo_asignado", evento: String(evento.id) }), { TTL: 60, urgency: "normal", timeout: 5000 });
        const { error: errSave } = await admin.from("push_entregas").upsert({ evento_id: evento.id, endpoint: sub.endpoint, enviado_at: new Date().toISOString() });
        if (errSave) retry = true;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          const { error: errDelete } = await admin.from("push_suscripciones").delete().eq("endpoint", sub.endpoint);
          if (errDelete) retry = true;
        }
        else retry = true;
      }
    }
    if (!retry) await cerrar();
  }
  const circuito = await despacharAvisos(admin, webpush);
  return NextResponse.json({ ok: true, circuito });
}
