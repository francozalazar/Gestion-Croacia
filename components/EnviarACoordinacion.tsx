"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/cliente";
import { Calendar, Clock, Send, X } from "lucide-react";
import Desplegable from "@/components/Desplegable";
import { enviarACoordinacionPasos } from "@/lib/pasosCircuito";

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

function hoyArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function EnviarACoordinacion({ solicitud }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [fecha, setFecha] = useState(hoyArgentina());
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

    // Primero la visita vinculada, después el pedido que lo saca de este listado.
    // Si algo falla, el pedido sigue en "Listos para colocar" y se puede reintentar.
    const r = await enviarACoordinacionPasos(supabase, solicitud.id, datosNuevos);
    if (!r.ok) {
      alert("No se pudo enviar a coordinación: " + r.error?.message + ". Probá de nuevo.");
      setGuardando(false);
      return;
    }

    setGuardando(false);
    setAbierto(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => {
          setFecha(hoyArgentina());
          setAbierto(true);
        }}
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
                  <Desplegable
                  value={franja}
                  onChange={setFranja}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  ariaLabel="Franja horaria"
                  placeholder="Coordinar con cliente..."
                  opciones={[
                  { value: "", label: "Coordinar con cliente..." },
                  { value: "manana", label: "Por la mañana (8:30 a 12:30)" },
                  { value: "tarde", label: "Por la tarde (13:00 a 17:00)" },
                  { value: "completo", label: "Día completo (8:30 a 17:00)" },
                  ...(franja === "custom"
                  ? [{ value: "custom", label: `Actual: ${(solicitud.horario_desde || "").slice(0, 5)} a ${(solicitud.horario_hasta || "").slice(0, 5)} hs` }]
                  : []),
                  ]}
                  />
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

// Botón "Ver detalles" de Instalación: sólo lectura, muestra la información
// cargada en el pedido. No incluye datos comerciales ni de pagos.
export function VerDetallesInstalacion({
  observaciones,
}: {
  observaciones?: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
      >
        Ver detalles
      </button>
      {abierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Detalles del trabajo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          onClick={() => setAbierto(false)}
        >
          <div
            className="w-full max-w-2xl rounded-lg bg-white p-8 text-left shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-semibold text-slate-900">
              Detalles del trabajo
            </h2>
            <p className="mt-6 font-bold text-slate-900">
              Información del trabajo:
            </p>
            <p className="mt-3 max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-base uppercase text-slate-600">
              {observaciones?.trim() || "Sin información cargada."}
            </p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="mt-6 rounded-lg px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
