"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";

export default function FotoTrabajo({ solicitudId }: { solicitudId: number }) {
  const [url, setUrl] = useState("");
  const [mensaje, setMensaje] = useState("Cargando foto...");
  useEffect(() => {
    let activo = true;
    setUrl(""); setMensaje("Cargando foto...");
    async function cargar() {
      const supabase = createClient();
      const { data, error } = await supabase.from("fotos_trabajos")
        .select("storage_path").eq("solicitud_id", solicitudId).maybeSingle();
      if (!activo) return;
      if (error) { setMensaje("No se pudo cargar la foto. Cerrá y volvé a abrir el detalle."); return; }
      if (!data) { setMensaje("Sin foto cargada (trabajo anterior a esta función)."); return; }
      const resultado = await supabase.storage.from("fotos-trabajos").createSignedUrl(data.storage_path, 3600);
      if (!activo) return;
      if (resultado.error || !resultado.data?.signedUrl) { setMensaje("No se pudo abrir la foto."); return; }
      setUrl(resultado.data.signedUrl);
    }
    cargar().catch(() => { if (activo) setMensaje("No se pudo cargar la foto."); });
    return () => { activo = false; };
  }, [solicitudId]);
  return <section className="my-4 rounded-md border border-slate-200 bg-slate-50 p-3">
    <h3 className="mb-2 text-sm font-semibold text-slate-900">Foto del trabajo finalizado</h3>
    {url ? <a href={url} target="_blank" rel="noopener noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Trabajo finalizado registrado por el técnico" className="max-h-96 w-full rounded-md object-contain" />
      <span className="mt-2 block text-xs text-blue-700">Abrir foto</span>
    </a> : <p className="text-xs text-slate-600">{mensaje}</p>}
  </section>;
}
