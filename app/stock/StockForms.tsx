"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
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
  compacto = false,
}: {
  motorId: number;
  pedidos: PedidoOpcion[];
  compacto?: boolean;
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
      <div className={compacto ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
        <label className="block text-sm font-medium text-slate-700">
          Cantidad
          <input name="cantidad" type="number" min={1} step={1} required className={campo} />
        </label>
      </div>
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
      <label className="block min-w-0 flex-1 text-xs font-medium text-slate-500">
        Avisar cuando queden
        <input
          name="minimo"
          type="number"
          min={0}
          step={1}
          defaultValue={minimo}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-slate-900"
        />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="shrink-0 rounded-lg bg-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 disabled:opacity-50"
      >
        {pendiente ? "..." : "Guardar"}
      </button>
      {res && !res.ok && <span className="text-xs text-red-700">{res.mensaje}</span>}
    </form>
  );
}

type MotorCard = { id: number; nombre: string; cantidad: number; minimo: number };

export function CardStockMotor({
  motor,
  pedidos,
  abiertoInicial = false,
}: {
  motor: MotorCard;
  pedidos: PedidoOpcion[];
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  const bajo = motor.cantidad <= motor.minimo;

  return (
    <div
      className={`self-start rounded-lg bg-white p-3 shadow-sm ${
        bajo ? "ring-1 ring-red-300" : ""
      }`}
    >
      <div className="flex flex-col items-start gap-1">
        <p className="break-words text-sm font-bold leading-tight text-slate-900">
          {motor.nombre}
        </p>
        {bajo && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
            <AlertTriangle size={11} />
            Por agotarse
          </span>
        )}
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <p className="text-[11px] leading-none text-slate-500">Quedan</p>
          <p
            className={`mt-1 text-2xl font-bold leading-none ${
              bajo ? "text-red-600" : "text-slate-900"
            }`}
          >
            {motor.cantidad}
          </p>
        </div>
        <p className="text-[11px] text-slate-500">Aviso en {motor.minimo}</p>
      </div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="mt-3 w-full rounded-md bg-slate-100 px-2 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
      >
        {abierto ? "Cerrar" : "Entrada / salida"}
      </button>
      {abierto && (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <FormularioMovimiento motorId={motor.id} pedidos={pedidos} compacto />
          <FormularioMinimo motorId={motor.id} minimo={motor.minimo} />
        </div>
      )}
    </div>
  );
}
