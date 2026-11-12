"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/cliente";
import { cargarNovedades, type Novedad } from "@/lib/novedades";

const ROLES = ["ADMIN", "OFICINA", "COORDINACION", "TECNICO", "FABRICA", "ENCARGADO"];

// Sonido corto cuando llega una novedad con la app abierta. El navegador sólo
// lo permite si el usuario ya tocó la página; si no, queda mudo.
function sonar() {
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1175].forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.18 + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.32);
    });
    setTimeout(() => ctx.close(), 1000);
  } catch {
    /* sin audio disponible */
  }
}

function cuando(fecha: string) {
  const d = new Date(fecha);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.floor(min / 60)} h`;
  return d.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}

// Campanita de novedades: las últimas 10 según el rol. El punto rojo sale
// cuando hay algo posterior a la última vez que se abrió el panel; esa marca se
// guarda por usuario en este dispositivo.
export default function Campanita({ rol }: { rol: string }) {
  const supabase = useRef(createClient()).current;
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<Novedad[]>([]);
  const [vistoHasta, setVistoHasta] = useState<number>(0);
  const [nuevasAlAbrir, setNuevasAlAbrir] = useState<Set<string>>(new Set());
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  const conocidas = useRef<Set<string> | null>(null);
  // La marca de "leído" vive en la base (se comparte entre celular y computadora).
  // Si la tabla todavía no existe, queda en este dispositivo.
  const enBase = useRef(false);
  const vistoRef = useRef(0);
  // Si el rol cambia mientras carga el perfil, solo vale la última consulta.
  const secuencia = useRef(0);
  const rolCargado = useRef("");
  const permitido = ROLES.includes((rol || "").toUpperCase());

  const clave = (id: string) => `croacia-campana-${id}`;

  const cargar = useCallback(async () => {
    if (!permitido) return;
    const mia = ++secuencia.current;
    if (rolCargado.current !== rol) { rolCargado.current = rol; conocidas.current = null; }
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id;
    if (!id) return;
    setUserId(id);
    let visto = Number(localStorage.getItem(clave(id)) || 0);
    const lectura = await supabase.from("campana_lecturas").select("visto_hasta").eq("usuario_id", id).maybeSingle();
    enBase.current = !lectura.error;
    if (!lectura.error) visto = Math.max(visto, lectura.data?.visto_hasta ? new Date(lectura.data.visto_hasta).getTime() : 0);
    vistoRef.current = visto;
    if (visto) localStorage.setItem(clave(id), String(visto));
    setVistoHasta(visto);
    try {
      const nuevas = await cargarNovedades(supabase, id, rol);
      if (mia !== secuencia.current) return;
      const previas = conocidas.current;
      if (previas && nuevas.some((n) => !previas.has(n.id) && new Date(n.fecha).getTime() > visto)) sonar();
      conocidas.current = new Set(nuevas.map((n) => n.id));
      setItems(nuevas);
    } catch {
      /* si falla, se reintenta en la próxima actualización */
    }
  }, [supabase, rol, permitido]);

  useEffect(() => {
    if (!permitido) return;
    void cargar();
    const timer = setInterval(() => { if (document.visibilityState === "visible") void cargar(); }, 30000);
    const alVolver = () => { if (document.visibilityState === "visible") void cargar(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [cargar, permitido]);

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  if (!permitido) return null;

  const esNueva = (n: Novedad) => new Date(n.fecha).getTime() > vistoHasta;
  const hayNuevas = items.some(esNueva);

  function alternar() {
    if (abierto) { setAbierto(false); return; }
    setNuevasAlAbrir(new Set(items.filter(esNueva).map((n) => n.id)));
    setAbierto(true);
    if (userId) {
      const ahora = Date.now();
      localStorage.setItem(clave(userId), String(ahora));
      setVistoHasta(ahora);
      vistoRef.current = ahora;
      if (enBase.current) {
        // El constructor de consultas solo envía al hacer then(): sin esto no se guardaba nada.
        void supabase
          .from("campana_lecturas")
          .upsert({ usuario_id: userId, visto_hasta: new Date(ahora).toISOString() }, { onConflict: "usuario_id" })
          .then(() => undefined, () => undefined);
      }
    }
    void cargar();
  }

  return (
    <div ref={caja}>
      <button
        type="button"
        onClick={alternar}
        aria-label={hayNuevas ? "Notificaciones, hay novedades sin leer" : "Notificaciones"}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      >
        <Bell size={18} />
        {hayNuevas && (
          <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-red-600" />
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-md border border-slate-200 bg-white text-left shadow-2xl">
          <div className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Notificaciones
          </div>
          <div className="max-h-[26rem] overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">No tenés notificaciones.</p>
            ) : (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link}
                  onClick={() => setAbierto(false)}
                  className={`block border-b border-slate-100 px-4 py-3 last:border-b-0 hover:bg-slate-50 ${nuevasAlAbrir.has(n.id) ? "bg-blue-50" : ""}`}
                >
                  <p className="text-sm font-semibold text-slate-900">{n.titulo}</p>
                  <p className="mt-0.5 text-xs text-slate-600">{n.detalle}</p>
                  <p className="mt-1 text-xs text-slate-500">{cuando(n.fecha)}</p>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
