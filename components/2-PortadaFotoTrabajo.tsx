"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";

// Portada de la card en Precio y Presupuestos: solo se muestra si el trabajo tiene foto.
// Si la página ya firmó las URLs (urlInicial, con urlFallback opcional), las usa directo
// sin volver a consultar. Si la imagen falla (ej. miniatura inexistente firmada igual),
// cae a urlFallback; si también falla, no muestra el área.
export default function PortadaFotoTrabajo({ solicitudId, urlInicial, urlFallback }: { solicitudId: number; urlInicial?: string; urlFallback?: string }) {
  const [url, setUrl] = useState(urlInicial || "");
  const [agotado, setAgotado] = useState(false);
  useEffect(() => {
    if (urlInicial !== undefined) { setUrl(urlInicial); setAgotado(false); return; }
    let activo = true;
    setUrl("");
    setAgotado(false);
    async function cargar() {
      const supabase = createClient();
      const { data } = await supabase.from("fotos_trabajos")
        .select("storage_path").eq("solicitud_id", solicitudId).maybeSingle();
      if (!activo || !data) return;
      const r = await supabase.storage.from("fotos-trabajos").createSignedUrl(data.storage_path, 3600);
      if (activo && r.data?.signedUrl) setUrl(r.data.signedUrl);
    }
    cargar().catch(() => {});
    return () => { activo = false; };
  }, [solicitudId, urlInicial]);
  if (!url || agotado) return null;
  return (
    <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-xl bg-slate-100 h-44">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Foto del trabajo finalizado" loading="lazy" className="h-44 w-full object-cover"
        onError={() => {
          if (urlFallback && url !== urlFallback) setUrl(urlFallback);
          else setAgotado(true);
        }} />
    </div>
  );
}
