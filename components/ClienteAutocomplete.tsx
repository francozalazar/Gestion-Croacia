"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/cliente";

type ClienteSugerido = { id: number; nombre: string };
type DireccionSugerida = { id: number; direccion: string; localidad: string | null };

export default function ClienteAutocomplete({
  cliente,
  setCliente,
  direccion,
  setDireccion,
  localidad,
  setLocalidad,
  inputClassName,
}: {
  cliente: string;
  setCliente: (v: string) => void;
  direccion: string;
  setDireccion: (v: string) => void;
  localidad: string;
  setLocalidad: (v: string) => void;
  inputClassName: string;
}) {
  const supabase = createClient();
  const [sugerencias, setSugerencias] = useState<ClienteSugerido[]>([]);
  const [direccionesCliente, setDireccionesCliente] = useState<DireccionSugerida[]>([]);
  const [clienteElegido, setClienteElegido] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          value={cliente}
          onChange={(e) => {
            setCliente(e.target.value);
            setClienteElegido(null);
            setDireccionesCliente([]);
          }}
          placeholder="Ej: Juan Pérez"
          className={inputClassName}
          autoComplete="off"
        />
        {sugerencias.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
            {sugerencias.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => elegirCliente(c)}
                className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-xl last:rounded-b-xl"
              >
                {c.nombre}
              </button>
            ))}
          </div>
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

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Localidad
        </label>
        <input
          value={localidad}
          onChange={(e) => setLocalidad(e.target.value)}
          placeholder="Ej: Quilmes"
          className={inputClassName}
        />
      </div>
    </>
  );
}
