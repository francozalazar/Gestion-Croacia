"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  crearModeloAction,
  registrarMovimientoAction,
  actualizarMinimoAction,
  type ResultadoStock,
} from "./actions";

const campo =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-900";

function Mensaje({ res }: { res: ResultadoStock | null }) {
  if (!res) return null;
  return (
    <p
      className={`rounded-xl px-4 py-2.5 text-sm ${
        res.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
      }`}
    >
      {res.mensaje}
    </p>
  );
}

export function FormularioModelo() {
  const [res, accion, pendiente] = useActionState<ResultadoStock | null, FormData>(
    crearModeloAction,
    null
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (res?.ok) form.current?.reset();
  }, [res]);

  return (
    <form action={accion} ref={form} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium text-slate-700 sm:col-span-1">
          Modelo (ej: Motor 600)
          <input name="nombre" required className={campo} autoComplete="off" />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Stock inicial
          <input
            name="inicial"
            type="number"
            min={0}
            step={1}
            defaultValue={0}
            className={campo}
          />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Avisar cuando queden
          <input
            name="minimo"
            type="number"
            min={0}
            step={1}
            defaultValue={0}
            className={campo}
          />
        </label>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pendiente ? "Guardando..." : "Agregar modelo"}
        </button>
      </div>
      <Mensaje res={res} />
    </form>
  );
}

type PedidoOpcion = { id: number; cliente_nombre: string | null };

export function FormularioMovimiento({
  motorId,
  pedidos,
}: {
  motorId: number;
  pedidos: PedidoOpcion[];
}) {
  const [tipo, setTipo] = useState<"ENTRADA" | "SALIDA">("ENTRADA");
  const [res, accion, pendiente] = useActionState<ResultadoStock | null, FormData>(
    registrarMovimientoAction,
    null
  );
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (res?.ok) form.current?.reset();
  }, [res]);

  return (
    <form action={accion} ref={form} className="space-y-3">
      <input type="hidden" name="motor_id" value={motorId} />
      <input type="hidden" name="tipo" value={tipo} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTipo("ENTRADA")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tipo === "ENTRADA"
              ? "bg-emerald-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Entrada
        </button>
        <button
          type="button"
          onClick={() => setTipo("SALIDA")}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            tipo === "SALIDA"
              ? "bg-amber-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Salida
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700">
          Cantidad
          <input name="cantidad" type="number" min={1} step={1} required className={campo} />
        </label>
        <label className="block text-sm font-medium text-slate-700">
          Detalle {tipo === "ENTRADA" ? "(ej: llegó compra)" : "(para qué se usó)"}
          <input name="detalle" className={campo} autoComplete="off" />
        </label>
      </div>
      {tipo === "SALIDA" && pedidos.length > 0 && (
        <label className="block text-sm font-medium text-slate-700">
          Trabajo en que se usó (opcional)
          <select name="solicitud_fabrica_id" defaultValue="" className={campo}>
            <option value="">Sin vincular</option>
            {pedidos.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id} · {p.cliente_nombre || "Sin cliente"}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={pendiente}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
            tipo === "ENTRADA" ? "bg-emerald-600" : "bg-amber-600"
          }`}
        >
          {pendiente ? "Guardando..." : tipo === "ENTRADA" ? "Cargar entrada" : "Cargar salida"}
        </button>
      </div>
      <Mensaje res={res} />
    </form>
  );
}

export function FormularioMinimo({
  motorId,
  minimo,
}: {
  motorId: number;
  minimo: number;
}) {
  const [res, accion, pendiente] = useActionState<ResultadoStock | null, FormData>(
    actualizarMinimoAction,
    null
  );

  return (
    <form action={accion} className="flex items-end gap-2">
      <input type="hidden" name="motor_id" value={motorId} />
      <label className="block text-xs font-medium text-slate-500">
        Avisar cuando queden
        <input
          name="minimo"
          type="number"
          min={0}
          step={1}
          defaultValue={minimo}
          className="mt-1 w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-900"
        />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-50"
      >
        {pendiente ? "..." : "Guardar"}
      </button>
      {res && !res.ok && <span className="text-xs text-red-700">{res.mensaje}</span>}
    </form>
  );
}
