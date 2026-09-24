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
  solicitudFabricaId: number; // ID de la tabla solicitudes_fabrica
  solicitudPadreId?: number;  // ID de la tabla principal solicitudes (opcional si viene en la relación)
  estadoActual: string;
}

export default function ActualizarEstadoFabrica({
  solicitudFabricaId,
  solicitudPadreId,
  estadoActual,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function cambiarEstado(nuevoEstado: string) {
    if (nuevoEstado === estadoActual && nuevoEstado !== "LISTO_PARA_COLOCAR") {
      return;
    }

    setGuardando(true);
    setMensaje("");

    // 1. Actualizamos el estado en la orden de fábrica (solicitudes_fabrica)
    const { data: ordenFabrica, error: errorFabrica } = await supabase
      .from("solicitudes_fabrica")
      .update({ estado: nuevoEstado })
      .eq("id", solicitudFabricaId)
      .select("solicitud_id") // Traemos el ID principal por si no vino por props
      .single();

    if (errorFabrica) {
      console.error("Error al actualizar estado en fábrica:", errorFabrica);
      setMensaje(`Error: ${errorFabrica.message}`);
      setGuardando(false);
      return;
    }

    // 2. Si el nuevo estado es LISTO_PARA_COLOCAR, actualizamos también la tabla principal
    if (nuevoEstado === "LISTO_PARA_COLOCAR") {
      const idPrincipal = solicitudPadreId || ordenFabrica?.solicitud_id;

      if (idPrincipal) {
        const { error: errorPrincipal } = await supabase
          .from("solicitudes")
          .update({ estado: "LISTO_PARA_COLOCAR" })
          .eq("id", idPrincipal);

        if (errorPrincipal) {
          console.error("Error al actualizar solicitud principal:", errorPrincipal);
          setMensaje(`Error en solicitud principal: ${errorPrincipal.message}`);
          setGuardando(false);
          return;
        }
      }
    }

    setMensaje("¡Estado actualizado correctamente!");
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
          onClick={() => cambiarEstado("EN_FABRICACION")}
          disabled={guardando || estadoActual === "EN_FABRICACION"}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Factory size={18} />
          En fabricación
        </button>

        {/* FALTANTES */}
        <button
          onClick={() => cambiarEstado("FALTANTES")}
          disabled={guardando || estadoActual === "FALTANTES"}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <AlertTriangle size={18} />
          Faltantes
        </button>

        {/* LISTO PARA COLOCAR */}
        <button
          onClick={() => cambiarEstado("LISTO_PARA_COLOCAR")}
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