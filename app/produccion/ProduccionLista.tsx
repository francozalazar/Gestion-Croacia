"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  anularProduccionAction,
  cambiarEstadoProduccionAction,
} from "./actions";

type Trabajo = {
  id: number;
  cliente_nombre?: string | null;
  cliente?: string | null;
  numero_remito?: number | null;
  estado: string;
  created_at?: string | null;
  fecha?: string | null;
  direccion?: string | null;
  localidad?: string | null;
  observaciones?: string | null;
};

function textoEstado(estado: string) {
  const estados: Record<string, string> = {
    ENVIADO_A_CORTAR: "Pendiente de producción",
    EN_CORTE: "En corte",
    EN_FABRICACION: "En proceso",
    EN_FABRICA: "En proceso",
    FALTANTES: "Faltantes",
    LISTO_PARA_COLOCAR: "Listo para colocar",
  };
  return estados[estado] || estado;
}

const opcionesEstado = [
  { value: "ENVIADO_A_CORTAR", label: "Pendiente de producción" },
  { value: "EN_CORTE", label: "En corte" },
  { value: "EN_FABRICACION", label: "En proceso" },
  { value: "FALTANTES", label: "Faltantes" },
  { value: "LISTO_PARA_COLOCAR", label: "Terminado (listo para colocar)" },
];

export default function ProduccionLista({
  trabajos,
  rol,
}: {
  trabajos: Trabajo[];
  rol: string;
}) {
  const [seleccionado, setSeleccionado] = useState<Trabajo | null>(null);
  const [nuevoEstado, setNuevoEstado] = useState("");

  function abrir(trabajo: Trabajo) {
    setNuevoEstado("");
    setSeleccionado(trabajo);
  }

  function cerrar() {
    setSeleccionado(null);
    setNuevoEstado("");
  }

  return (
    <>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {trabajos.map((trabajo) => (
          <article
            key={trabajo.id}
            onClick={() => abrir(trabajo)}
            className="cursor-pointer rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-900">
                  {trabajo.cliente_nombre || trabajo.cliente || "Cliente sin nombre"}
                </h2>
                <p className="text-xs text-slate-500">
                  Remito #{trabajo.numero_remito || trabajo.id}
                </p>
              </div>

              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {textoEstado(trabajo.estado)}
              </span>
            </div>

            <div className="mt-5 space-y-2 text-sm text-slate-600">
              <p>
                <strong>Solicitud creada:</strong>{" "}
                {trabajo.created_at
                  ? new Date(trabajo.created_at).toLocaleDateString("es-AR")
                  : "-"}
              </p>
              <p>
                <strong>Finalización estimada:</strong> {trabajo.fecha || "-"}
              </p>
              <p>
                <strong>Dirección:</strong> {trabajo.direccion || "-"}
              </p>
              <p>
                <strong>Localidad:</strong> {trabajo.localidad || "-"}
              </p>
            </div>

            {rol === "ADMIN" && (
              <form
                action={anularProduccionAction}
                className="mt-5"
                onClick={(e) => e.stopPropagation()}
              >
                <input type="hidden" name="id" value={trabajo.id} />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                >
                  Anular
                </button>
              </form>
            )}
          </article>
        ))}
      </div>

      {seleccionado && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={cerrar}
        >
          <div
            className="relative w-full max-w-2xl rounded-xl bg-white p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={cerrar}
              className="absolute right-5 top-5 text-slate-400 hover:text-slate-700"
              aria-label="Cerrar"
            >
              <X size={22} />
            </button>

            <h2 className="text-2xl font-bold text-slate-900">
              {seleccionado.cliente_nombre || seleccionado.cliente || "Cliente sin nombre"}
            </h2>
            <p className="mt-1 text-lg text-slate-500">
              {seleccionado.direccion || "-"}
              {seleccionado.localidad
                ? ` - ${seleccionado.localidad.toUpperCase()}`
                : ""}
            </p>

            <p className="mt-5 text-sm text-slate-700">
              <strong>Fecha estimada:</strong> {seleccionado.fecha || "-"}
            </p>

            <div className="mt-5">
              <h3 className="text-sm font-bold text-slate-900">
                Información del proyecto
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {seleccionado.observaciones || "Sin información cargada."}
              </p>
            </div>

            {rol === "ADMIN" && (
              <form
                action={cambiarEstadoProduccionAction}
                className="mt-8"
                onSubmit={cerrar}
              >
                <input type="hidden" name="id" value={seleccionado.id} />
                <select
                  name="nuevoEstado"
                  value={nuevoEstado}
                  onChange={(e) => setNuevoEstado(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-500 outline-none focus:border-slate-400"
                >
                  <option value="" disabled>
                    Seleccione un estado
                  </option>
                  {opcionesEstado.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>

                <div className="mt-4 flex justify-end">
                  <button
                    type="submit"
                    disabled={!nuevoEstado}
                    className="rounded-xl bg-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-500 transition enabled:bg-slate-900 enabled:text-white enabled:hover:bg-slate-800 disabled:cursor-not-allowed"
                  >
                    Cambiar estado
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
