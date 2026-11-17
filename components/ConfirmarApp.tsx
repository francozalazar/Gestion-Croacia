"use client";

import { useCallback, useRef, useState } from "react";

type OpcionesConfirmar = {
  /** Rojo para acciones destructivas (anular, eliminar). Azul por defecto. */
  peligro?: boolean;
  confirmarTexto?: string;
};

/**
 * Confirmación con el estilo de la app (reemplaza el cartel nativo del navegador).
 * Uso:
 *   const { confirmar, dialogo } = useConfirmar();
 *   if (!(await confirmar("¿Seguro?", { peligro: true }))) return;
 *   ...en el JSX: {dialogo}
 */
export function useConfirmar() {
  const [actual, setActual] = useState<{ mensaje: string; opciones: OpcionesConfirmar } | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);

  const confirmar = useCallback((mensaje: string, opciones: OpcionesConfirmar = {}) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setActual({ mensaje, opciones });
    });
  }, []);

  function responder(valor: boolean) {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setActual(null);
  }

  const dialogo = actual ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      role="alertdialog"
      aria-modal="true"
      aria-label="Confirmación"
      onClick={() => responder(false)}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-slate-900">Confirmación</h2>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{actual.mensaje}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => responder(false)}
            className="rounded-xl bg-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
          >
            Cancelar
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => responder(true)}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition ${actual.opciones.peligro ? "bg-red-600 hover:bg-red-700" : "bg-blue-700 hover:bg-blue-800"}`}
          >
            {actual.opciones.confirmarTexto || "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmar, dialogo };
}
