"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/cliente";
import { Calendar, Clock, Send, X } from "lucide-react";

interface Props {
  solicitud: {
    id: number;
    numero_remito: number;
    fecha?: string | null;
    horario_desde?: string | null;
    horario_hasta?: string | null;
    observaciones?: string | null;
  };
}

const FRANJAS: Record<string, { desde: string; hasta: string }> = {
  manana: { desde: "08:30", hasta: "12:30" },
  tarde: { desde: "13:00", hasta: "17:00" },
  completo: { desde: "08:30", hasta: "17:00" },
};

// Misma lógica de lectura que usan Recorrido de camiones y Trabajos
function franjaDesdeHorario(
  desde?: string | null,
  hasta?: string | null
): string {
  if (!desde && !hasta) return "";
  const hDesde = (desde || "").slice(0, 5);
  const hHasta = (hasta || "").slice(0, 5);
  if (
    ["08:00", "08:30", "09:00"].includes(hDesde) &&
    ["12:00", "12:30", "13:00"].includes(hHasta)
  ) {
    return "manana";
  }
  if (
    ["13:00", "13:30", "14:00"].includes(hDesde) &&
    ["17:00", "17:30", "18:00"].includes(hHasta)
  ) {
    return "tarde";
  }
  if (
    ["08:00", "08:30", "09:00"].includes(hDesde) &&
    ["17:00", "17:30", "18:00"].includes(hHasta)
  ) {
    return "completo";
  }
  return "custom";
}

export default function EnviarACoordinacion({ solicitud }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fecha, setFecha] = useState(solicitud.fecha || "");
  const [franja, setFranja] = useState(() =>
    franjaDesdeHorario(solicitud.horario_desde, solicitud.horario_hasta)
  );
  const [observaciones, setObservaciones] = useState(solicitud.observaciones || "");

  async function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);

    let horarioDesde: string | null = null;
    let horarioHasta: string | null = null;
    if (franja === "custom") {
      // Horario ya pactado con valores no estándar: se conserva tal cual
      horarioDesde = solicitud.horario_desde || null;
      horarioHasta = solicitud.horario_hasta || null;
    } else if (franja && FRANJAS[franja]) {
      horarioDesde = FRANJAS[franja].desde;
      horarioHasta = FRANJAS[franja].hasta;
    }

    const datosNuevos = {
      estado: "PENDIENTE_COORDINACION",
      fecha: fecha || null,
      horario_desde: horarioDesde,
      horario_hasta: horarioHasta,
      observaciones: observaciones || null,
    };

    // 1. Actualizamos en solicitudes_fabrica
    await supabase
      .from("solicitudes_fabrica")
      .update(datosNuevos)
      .eq("id", solicitud.id);

    // 2. Actualizamos la tabla principal "solicitudes" (vinculada por solicitud_fabrica_id)
    await supabase
      .from("solicitudes")
      .update(datosNuevos)
      .eq("solicitud_fabrica_id", solicitud.id);

    setGuardando(false);
    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
      >
        <Send size={15} />
        Enviar a coordinación
      </button>

      {abierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="text-lg font-bold text-slate-900">
                Coordinar instalación - Remito Nº {solicitud.numero_remito}
              </h3>
              <button
                onClick={() => setAbierto(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEnviar} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase text-slate-500 mb-1">
                  Fecha pactada
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase text-slate-500 mb-1">
                  Franja horaria
                </label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 text-slate-400" size={18} />
                  <select
                    value={franja}
                    onChange={(e) => setFranja(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="">Coordinar con cliente...</option>
                    <option value="manana">Por la mañana (8:30 a 12:30)</option>
                    <option value="tarde">Por la tarde (13:00 a 17:00)</option>
                    <option value="completo">Día completo (8:30 a 17:00)</option>
                    {franja === "custom" && (
                      <option value="custom">
                        Actual: {(solicitud.horario_desde || "").slice(0, 5)} a{" "}
                        {(solicitud.horario_hasta || "").slice(0, 5)} hs
                      </option>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase text-slate-500 mb-1">
                  Observaciones / Notas para la coordinación
                </label>
                <textarea
                  rows={3}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Aclaraciones especiales sobre la colocación..."
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {guardando ? "Enviando..." : "Enviar a coordinación"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
