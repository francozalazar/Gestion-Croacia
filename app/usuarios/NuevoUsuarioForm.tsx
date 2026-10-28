"use client";

import { useActionState, useRef, useState } from "react";
import { crearUsuarioAction, type ResultadoAlta } from "./actions";
import Desplegable from "@/components/Desplegable";

const ROLES = [
  { v: "ENCARGADO", t: "Encargado (operaciones y remitos propios)" },
  { v: "OFICINA", t: "Oficina (carga pedidos y clientes)" },
  { v: "COORDINACION", t: "Coordinación" },
  { v: "TECNICO", t: "Técnico" },
  { v: "FABRICA", t: "Fábrica" },
  { v: "ADMIN", t: "Administrador (ve todo)" },
];

export default function NuevoUsuarioForm() {
  const form = useRef<HTMLFormElement>(null);
  const [resetKey, setResetKey] = useState(0);
  const [res, accion, pendiente] = useActionState<ResultadoAlta | null, FormData>(
    async (prev, fd) => {
      const r = await crearUsuarioAction(prev, fd);
      if (r?.ok) {
        form.current?.reset();
        setResetKey((k) => k + 1);
      }
      return r;
    },
    null
  );

  const campo =
    "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-900";

  return (
    <form
      ref={form}
      action={accion}
      className="rounded-2xl bg-white p-6 shadow-sm space-y-4 max-w-xl"
    >
      <h2 className="text-lg font-bold text-slate-900">Nuevo usuario</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">
          Nombre para ingresar
          <input name="nombre" required maxLength={80} className={campo} autoComplete="off" />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-700">
        Rol
        <Desplegable
        key={resetKey}
        name="rol"
        required
        className={campo}
        ariaLabel="Rol"
        placeholder="Elegí un rol"
        opciones={ROLES.map((r) => ({ value: r.v, label: r.t }))}
        />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Contraseña para el primer ingreso (mínimo 6 caracteres)
        <input
          name="password"
          type="text"
          required
          minLength={6}
          className={campo}
          autoComplete="new-password"
        />
      </label>
      <button
        type="submit"
        disabled={pendiente}
        className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50"
      >
        {pendiente ? "Creando..." : "Crear usuario"}
      </button>
      {res && (
        <p
          className={`rounded-xl px-4 py-3 text-sm ${
            res.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {res.mensaje}
        </p>
      )}
    </form>
  );
}
