"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/cliente";
import {
  Factory,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

interface Props {
  solicitudId: number;
  estadoActual: string;
}

export default function ActualizarEstadoFabrica({
  solicitudId,
  estadoActual,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [guardando, setGuardando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  async function cambiarEstado(
    nuevoEstado: string
  ) {
    if (nuevoEstado === estadoActual) {
      return;
    }

    setGuardando(true);
    setMensaje("");

    const { error } = await supabase
      .from("solicitudes")
      .update({
        estado: nuevoEstado,
      })
      .eq("id", solicitudId);

    if (error) {
      console.error(error);

      setMensaje(
        `Error: ${error.message}`
      );

      setGuardando(false);
      return;
    }

    setMensaje(
      "Estado actualizado correctamente."
    );

    setGuardando(false);

    router.refresh();
  }

  return (
    <div>
      <p className="mb-3 text-sm font-semibold text-slate-700">
        Cambiar estado del trabajo
      </p>

      <div className="flex flex-col gap-3 md:flex-row">
        {/* EN FABRICACIÓN */}

        <button
          onClick={() =>
            cambiarEstado(
              "EN_FABRICACION"
            )
          }
          disabled={
            guardando ||
            estadoActual ===
              "EN_FABRICACION"
          }
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Factory size={18} />

          En fabricación
        </button>

        {/* FALTANTES */}

        <button
          onClick={() =>
            cambiarEstado(
              "FALTANTES"
            )
          }
          disabled={
            guardando ||
            estadoActual ===
              "FALTANTES"
          }
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AlertTriangle size={18} />

          Faltantes
        </button>

        {/* LISTO PARA COLOCAR */}

        <button
          onClick={() =>
            cambiarEstado(
              "LISTO_PARA_COLOCAR"
            )
          }
          disabled={guardando}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 size={18} />

          Listo para colocar
        </button>
      </div>

      {mensaje && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          {mensaje}
        </div>
      )}
    </div>
  );
}