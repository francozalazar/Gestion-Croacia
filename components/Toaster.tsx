"use client";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { EVENTO_TOAST, type TipoToast } from "@/lib/toast";

type Item = { id: number; tipo: TipoToast; mensaje: string };

export default function Toaster() {
  const [items, setItems] = useState<Item[]>([]);
  const contador = useRef(0);
  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const quitar = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));
    function alMostrar(e: Event) {
      const { tipo, mensaje } = (e as CustomEvent).detail || {};
      if (!mensaje || (tipo !== "ok" && tipo !== "error")) return;
      const id = ++contador.current;
      setItems((prev) => [...prev.filter((i) => !(i.tipo === tipo && i.mensaje === mensaje)), { id, tipo, mensaje }].slice(-3));
      timers.add(setTimeout(() => quitar(id), tipo === "ok" ? 4000 : 7000));
    }
    window.addEventListener(EVENTO_TOAST, alMostrar);
    return () => {
      window.removeEventListener(EVENTO_TOAST, alMostrar);
      timers.forEach(clearTimeout);
    };
  }, []);
  if (!items.length) return null;
  return (
    <div className="pointer-events-none fixed right-3 top-16 z-[100] flex w-[calc(100vw-1.5rem)] max-w-sm flex-col gap-2 sm:right-4">
      {items.map((i) => (
        <div
          key={i.id}
          role={i.tipo === "error" ? "alert" : "status"}
          onClick={() => setItems((prev) => prev.filter((x) => x.id !== i.id))}
          className={`pointer-events-auto flex items-start gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${i.tipo === "ok" ? "bg-emerald-600" : "bg-red-600"}`}
        >
          {i.tipo === "ok" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span className="break-words">{i.mensaje}</span>
        </div>
      ))}
    </div>
  );
}
