"use client";
import { useEffect, useState } from "react";
export default function AvisosAndroid() {
  const [disponible, setDisponible] = useState(false);
  const [activo, setActivo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [comprobado, setComprobado] = useState(false);
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) { setComprobado(true); setMensaje("Este navegador no admite estos avisos. En computadora usá Chrome o Firefox; en Android, Chrome."); return; }
    fetch("/api/push/suscripcion").then(r => r.json()).then(async c => {
      if (!c.disponible) return;
      setDisponible(true);
      setComprobado(true);
      let reg = await navigator.serviceWorker.getRegistration("/");
      if (reg) reg = await navigator.serviceWorker.register("/push-sw.js");
      const sub = await reg?.pushManager.getSubscription();
      // Vincular de nuevo al usuario actual si el celular cambió de sesión.
      if (sub) {
        const r = await fetch("/api/push/suscripcion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
        setActivo(r.ok);
      }
    }).catch(() => {});
  }, []);
  async function cambiar() {
    setOcupado(true); setMensaje("");
    try {
      if (activo) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        const sub = await reg?.pushManager.getSubscription();
        if (sub) {
          const r = await fetch("/api/push/suscripcion", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          if (!r.ok) throw new Error("No se pudo desactivar. Probá de nuevo.");
          await sub.unsubscribe();
        }
        setActivo(false); setMensaje("Avisos desactivados en este dispositivo.");
      } else {
        // El pedido de permiso nace del toque, no de una carga automática.
        if (await Notification.requestPermission() !== "granted") throw new Error("No se activaron los avisos. Revisá el permiso de notificaciones de este sitio en el navegador.");
        const c = await fetch("/api/push/suscripcion").then(r => r.json());
        if (!c.disponible || !c.publicKey) throw new Error("Los avisos todavía no están disponibles.");
        await navigator.serviceWorker.register("/push-sw.js");
        const reg = await navigator.serviceWorker.ready;
        const key = Uint8Array.from(atob(c.publicKey.replace(/-/g, "+").replace(/_/g, "/")), ch => ch.charCodeAt(0));
        const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
        const r = await fetch("/api/push/suscripcion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
        if (!r.ok) throw new Error("No se pudo guardar el permiso. Probá de nuevo.");
        setActivo(true); setMensaje("Avisos activados en este dispositivo para tu usuario.");
      }
    } catch(e) { setMensaje(e instanceof Error ? e.message : "No se pudo cambiar el aviso."); }
    finally { setOcupado(false); }
  }
  if (!disponible) return comprobado && mensaje ? <p className="mb-6 text-sm text-slate-600">{mensaje}</p> : null;
  return <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Avisos en este dispositivo</h2><p className="mt-1 text-sm text-slate-600">Recibí los avisos de tus trabajos y aprobaciones aunque no estés mirando la app. Cada usuario activa este permiso en su celular o computadora. El sonido depende del navegador y de la configuración del dispositivo. No incluye datos del cliente.</p><button type="button" disabled={ocupado} onClick={cambiar} className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{ocupado ? "Guardando..." : activo ? "Desactivar avisos" : "Activar avisos de trabajos"}</button>{mensaje && <p role="status" className="mt-2 text-sm">{mensaje}</p>}</section>;
}
