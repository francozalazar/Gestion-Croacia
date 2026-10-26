"use client";

import { useState, useTransition } from "react";
import { actualizarEstadoAction } from "./actions";

const OPCIONES = [
  { value: "EN_FABRICACION", label: "En producción" },
  { value: "FALTANTES", label: "Faltantes" },
  { value: "LISTO_PARA_COLOCAR", label: "Terminado" },
];

// Los estados guardados ENVIADO_A_CORTAR / EN_CORTE / EN_FABRICA se muestran
// como "En producción", igual que el badge de la tarjeta.
function valorGuardado(estado: string) {
  return estado === "FALTANTES" ? "FALTANTES" : "EN_FABRICACION";
}

export default function SelectorEstado({
  id,
  estadoActual,
}: {
  id: number;
  estadoActual: string;
}) {
  const guardado = valorGuardado(estadoActual);
  const [elegido, setElegido] = useState(guardado);
  const [cambiando, startCambio] = useTransition();

  function cambiar(nuevo: string) {
    setElegido(nuevo);
    // "Terminado" NO persiste al elegirlo: solo muestra el botón de
    // confirmación. Los otros dos estados se aplican como antes (mismo
    // uso que el desplegable de prioridad).
    if (nuevo === "LISTO_PARA_COLOCAR" || nuevo === guardado) return;
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("nuevoEstado", nuevo);
    startCambio(async () => {
      await actualizarEstadoAction(fd);
    });
  }

  function confirmarTerminado() {
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("nuevoEstado", "LISTO_PARA_COLOCAR");
    startCambio(async () => {
      await actualizarEstadoAction(fd);
    });
  }

  return (
    <div className="w-full sm:w-72">
      <select
        value={elegido}
        disabled={cambiando}
        onChange={(e) => cambiar(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500 disabled:opacity-50"
      >
        {OPCIONES.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>

      {elegido === "LISTO_PARA_COLOCAR" && (
        <button
          type="button"
          onClick={confirmarTerminado}
          disabled={cambiando}
          className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          {cambiando ? "Enviando..." : "Enviar a Listos para colocar"}
        </button>
      )}
    </div>
  );
}
