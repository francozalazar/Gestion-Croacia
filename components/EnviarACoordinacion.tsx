"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/cliente";
import { Send } from "lucide-react";
import { ESTADO_FABRICA, ESTADO_SOLICITUD } from "@/lib/estados";

interface Props {
  // id del remito en `solicitudes_fabrica`
  solicitudFabricaId: number;
}

export default function EnviarACoordinacion({
  solicitudFabricaId,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function enviar() {
    setEnviando(true);
    setMensaje("");

    // 1. El trabajo vinculado en `solicitudes` pasa a Coordinación
    const { data: actualizadas, error } = await supabase
      .from("solicitudes")
      .update({
        estado: ESTADO_SOLICITUD.PENDIENTE_COORDINACION,
      })
      .eq("solicitud_fabrica_id", solicitudFabricaId)
      .select("id");

    if (error) {
      console.error(error);
      setMensaje(`Error: ${error.message}`);
      setEnviando(false);
      return;
    }

    if (!actualizadas || actualizadas.length === 0) {
      setMensaje(
        "Error: no se encontró el trabajo vinculado a este remito. Revisá que tenga cargado solicitud_fabrica_id en la tabla solicitudes."
      );
      setEnviando(false);
      return;
    }

    // 2. El remito sale de "Listos para colocar"
    const { error: errorFabrica } = await supabase
      .from("solicitudes_fabrica")
      .update({
        estado: ESTADO_FABRICA.ENVIADO_COORDINACION,
      })
      .eq("id", solicitudFabricaId);

    if (errorFabrica) {
      console.error(errorFabrica);
      setMensaje(
        `El trabajo llegó a Coordinación, pero no se pudo actualizar el remito: ${errorFabrica.message}`
      );
      setEnviando(false);
      router.refresh();
      return;
    }

    setMensaje(
      "Trabajo enviado a Coordinación correctamente."
    );

    setEnviando(false);

    router.refresh();
  }

  return (
    <div>
      <button
        onClick={enviar}
        disabled={enviando}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={18} />

        {enviando
          ? "Enviando..."
          : "Enviar a Coordinación"}
      </button>

      {mensaje && (
        <div
          className={`mt-3 rounded-xl p-3 text-sm ${
            mensaje.startsWith("Error")
              ? "bg-red-50 text-red-700"
              : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {mensaje}
        </div>
      )}
    </div>
  );
}
