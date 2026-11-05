"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";
import ProvinciaLocalidad from "@/components/ProvinciaLocalidad";

type ClienteSugerido = { id: number; nombre: string };
type DireccionSugerida = { id: number; direccion: string; localidad: string | null };

export default function ClienteAutocomplete({
  cliente,
  setCliente,
  direccion,
  setDireccion,
  localidad,
  setLocalidad,
  onProvinciaChange,
  inputClassName,
}: {
  cliente: string;
  setCliente: (v: string) => void;
  direccion: string;
  setDireccion: (v: string) => void;
  localidad: string;
  setLocalidad: (v: string) => void;
  onProvinciaChange?: (p: string) => void;
  inputClassName: string;
}) {
  const supabase = createClient();
  const [sugerencias, setSugerencias] = useState<ClienteSugerido[]>([]);
  const [direccionesCliente, setDireccionesCliente] = useState<DireccionSugerida[]>([]);
  const [clienteElegido, setClienteElegido] = useState<number | null>(null);
  const [todos, setTodos] = useState<ClienteSugerido[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [nuevoConfirmado, setNuevoConfirmado] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ignorarBlur = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Al enfocar el campo vacío, se cargan los clientes existentes para
  // elegir de la lista (como en la solicitud normal).
  async function cargarTodos() {
    if (todos.length > 0) return;
    try {
      const { data } = await supabase
        .from("clientes")
        .select("id, nombre")
        .order("nombre")
        .limit(200);
      setTodos(data || []);
    } catch {
      setTodos([]);
    }
  }

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);

    const texto = cliente.trim();
    if (texto.length < 2 || clienteElegido !== null) {
      setSugerencias([]);
      return;
    }

    timer.current = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("clientes")
          .select("id, nombre")
          .ilike("nombre", `%${texto}%`)
          .order("nombre")
          .limit(5);
        setSugerencias(data || []);
      } catch {
        setSugerencias([]);
      }
    }, 300);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [cliente, clienteElegido]);

  async function elegirCliente(c: ClienteSugerido) {
    setCliente(c.nombre);
    setClienteElegido(c.id);
    setSugerencias([]);
    try {
      const { data } = await supabase
        .from("direcciones")
        .select("id, direccion, localidad")
        .eq("cliente_id", c.id)
        .order("created_at", { ascending: false })
        .limit(6);
      setDireccionesCliente(data || []);
    } catch {
      setDireccionesCliente([]);
    }
  }

  function elegirDireccion(d: DireccionSugerida) {
    setDireccion(d.direccion);
    setLocalidad(d.localidad || "");
  }

  return (
    <>
      <div className="md:col-span-2 relative">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Nombre / Razón social *
        </label>
        <input
          ref={inputRef}
          value={cliente}
          onChange={(e) => {
            setCliente(e.target.value);
            setClienteElegido(null);
            setNuevoConfirmado(false);
            setDireccionesCliente([]);
            setAbierto(true);
          }}
          onFocus={() => {
            setAbierto(true);
            cargarTodos();
          }}
          onBlur={() => {
            if (!ignorarBlur.current) setAbierto(false);
          }}
          placeholder="Ej: Juan Pérez"
          className={inputClassName}
          autoComplete="off"
        />
        {abierto &&
          (sugerencias.length > 0 ||
            cliente.trim().length >= 2 ||
            (cliente.trim().length === 0 && todos.length > 0)) && (
          <div
            className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
            onMouseDown={() => {
              ignorarBlur.current = true;
            }}
            onMouseUp={() => {
              ignorarBlur.current = false;
            }}
          >
            {cliente.trim().length >= 2 ? (
              <button
                type="button"
                onClick={() => {
                  setClienteElegido(null);
                  setNuevoConfirmado(true);
                  setSugerencias([]);
                  setAbierto(false);
                }}
                className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                + Cliente nuevo: {cliente.trim()}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  // Sin texto todavía: el alta empieza escribiendo el nombre.
                  inputRef.current?.focus();
                }}
                className="block w-full border-b border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                + Cliente nuevo
              </button>
            )}
            {(cliente.trim().length === 0 ? todos : sugerencias).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  elegirCliente(c);
                  setNuevoConfirmado(false);
                  setAbierto(false);
                }}
                className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl"
              >
                {c.nombre}
              </button>
            ))}
          </div>
        )}
        {nuevoConfirmado && clienteElegido === null && cliente.trim().length >= 2 && (
          <p className="mt-2 text-xs font-medium text-slate-600">
            Se va a crear un cliente nuevo con este nombre al guardar.
          </p>
        )}
      </div>

      <div className="md:col-span-2">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Dirección *
        </label>
        <input
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          placeholder="Ej: Av. Mitre 1234"
          className={inputClassName}
          autoComplete="off"
        />
        {direccionesCliente.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {direccionesCliente.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => elegirDireccion(d)}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
              >
                {d.direccion}
                {d.localidad ? ` (${d.localidad})` : ""}
              </button>
            ))}
          </div>
        )}
      </div>

      <ProvinciaLocalidad
        localidad={localidad}
        setLocalidad={setLocalidad}
        onProvinciaChange={onProvinciaChange}
        inputClassName={inputClassName}
      />
    </>
  );
}
