"use client";

import { useActionState, useRef, useState } from "react";
import { cambiarClaveUsuarioAction, eliminarUsuarioAction, type ResultadoAlta } from "./actions";

type Usuario = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  rol: string;
  activo: boolean | null;
};

export default function FilaUsuario({ u }: { u: Usuario }) {
  const [abierto, setAbierto] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const [res, accion, pendiente] = useActionState<ResultadoAlta | null, FormData>(
    async (prev, fd) => {
      const r = await cambiarClaveUsuarioAction(prev, fd);
      if (r?.ok) {
        form.current?.reset();
        setAbierto(false);
      }
      return r;
    },
    null
  );

  const [resEliminar, eliminar, eliminando] = useActionState<ResultadoAlta | null, FormData>(
    async (prev, fd) => {
      const n = `${u.nombre || ""} ${u.apellido || ""}`.trim() || "este usuario";
      if (!window.confirm(`¿Eliminar a ${n}? Ya no va a poder entrar. Sus trabajos y su historial se conservan.`)) return prev;
      return eliminarUsuarioAction(prev, fd);
    },
    null
  );

  const nombre = `${u.nombre || ""} ${u.apellido || ""}`.trim() || "Sin nombre";

  return (
    <li className="py-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-slate-900">{nombre}</span>
        <span className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-500">
            {u.rol}
            {u.activo === false ? " · inactivo" : ""}
          </span>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="text-xs font-semibold text-slate-700 underline"
          >
            {abierto ? "Cancelar" : "Cambiar contraseña"}
          </button>
          <form action={eliminar}>
            <input type="hidden" name="usuario_id" value={u.id} />
            <button type="submit" disabled={eliminando} className="text-xs font-semibold text-red-700 underline disabled:opacity-50">
              {eliminando ? "Eliminando..." : "Eliminar"}
            </button>
          </form>
        </span>
      </div>
      {abierto && (
        <form ref={form} action={accion} className="mt-2 flex items-center gap-2">
          <input type="hidden" name="usuario_id" value={u.id} />
          <input
            name="password"
            type="password"
            required
            minLength={6}
            maxLength={72}
            placeholder="Nueva contraseña (mínimo 6)"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900"
            autoComplete="new-password"
          />
          <button
            type="submit"
            disabled={pendiente}
            className="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {pendiente ? "Guardando..." : "Guardar"}
          </button>
        </form>
      )}
      {resEliminar && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${resEliminar.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {resEliminar.mensaje}
        </p>
      )}
      {res && (
        <p
          className={`mt-2 rounded-lg px-3 py-2 text-xs ${
            res.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {res.mensaje}
        </p>
      )}
    </li>
  );
              }
