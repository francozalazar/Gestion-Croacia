"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";

// Portada de la card en Precio y Presupuestos: solo se muestra si el trabajo tiene foto.
export default function PortadaFotoTrabajo({ solicitudId }: { solicitudId: number }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let activo = true;
    setUrl("");
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
  }, [solicitudId]);
  if (!url) return null;
  return (
    <div className="-mx-6 -mt-6 mb-4 overflow-hidden rounded-t-xl bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Foto del trabajo finalizado" loading="lazy" className="h-44 w-full object-cover" />
    </div>
  );
}
