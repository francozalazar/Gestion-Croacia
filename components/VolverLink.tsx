"use client";

import { useRouter } from "next/navigation";
import { leerRecorrido } from "@/components/NavTracker";

export default function VolverLink({
  fallback,
  className,
}: {
  fallback: string;
  className?: string;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        // Solo vuelve atras si hay una pantalla anterior DE LA APP en esta pestana.
        // Si se entro directo o desde afuera, va al destino de respaldo.
        if (leerRecorrido().length >= 2) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      className={className || "text-sm text-slate-500 hover:text-slate-800"}
    >
      ← Volver
    </button>
  );
}
