"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/cliente";
import { Send } from "lucide-react";

interface Props {
  solicitudId: number;
}

export default function EnviarACoordinacion({
  solicitudId,
}: Props) {
  const supabase = createClient();
  const router = useRouter();

  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  async function enviar() {
    setEnviando(true);
    setMensaje("");

    const { error } = await supabase
      .from("solicitudes")
      .update({
        estado: "PENDIENTE_COORDINACION",
      })
      .eq("id", solicitudId);

    if (error) {
      console.error(error);

      setMensaje(
        `Error: ${error.message}`
      );

      setEnviando(false);
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
        <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
          {mensaje}
        </div>
      )}
    </div>
  );
}