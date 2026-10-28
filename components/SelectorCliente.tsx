"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

type Cliente = { id: number; nombre: string; telefono: string | null };
export default function SelectorCliente({ clientes, value, onSelect, className }: {
  clientes: Cliente[]; value: number | null; onSelect: (cliente: Cliente | null) => void; className: string;
}) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  const elegido = clientes.find(c => c.id === value);
  const normalizar = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const opciones = clientes.filter(c => normalizar(c.nombre).includes(normalizar(texto).trim()));
  function seleccionar(c: Cliente) { onSelect(c); setTexto(""); setAbierto(false); setActivo(-1); }
  return <div className="relative min-w-0 flex-1" onBlur={e => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) { setAbierto(false); setActivo(-1); }
  }}>
    <input role="combobox" aria-label="Cliente" aria-autocomplete="list" aria-expanded={abierto}
      aria-controls={id} aria-activedescendant={activo >= 0 && abierto ? `${id}-${activo}` : undefined}
      autoComplete="off" placeholder="Escribí para buscar un cliente..." className={className}
      value={abierto ? texto : (elegido?.nombre || texto)}
      onFocus={() => { setTexto(""); setAbierto(true); setActivo(-1); }}
      onChange={e => { setTexto(e.target.value); onSelect(null); setAbierto(true); setActivo(-1); }}
      onKeyDown={e => {
        if (e.key === "Escape") { e.preventDefault(); setAbierto(false); }
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault(); setAbierto(true);
          setActivo(i => Math.max(0, Math.min(opciones.length - 1, i + (e.key === "ArrowDown" ? 1 : -1))));
        }
        if (e.key === "Enter") { e.preventDefault(); if (abierto && activo >= 0 && opciones[activo]) seleccionar(opciones[activo]); }
      }} />
    <ChevronDown size={16} className="pointer-events-none absolute right-4 top-4 text-slate-400" />
    {abierto && <ul id={id} role="listbox" aria-label="Clientes" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
      {opciones.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No hay clientes con ese nombre.</li>}
      {opciones.map((c, i) => <li key={c.id} id={`${id}-${i}`} role="option" aria-selected={c.id === value}>
        <button type="button" className={`w-full break-words px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 ${i === activo ? "bg-blue-50" : ""}`}
          onMouseDown={e => e.preventDefault()} onClick={() => seleccionar(c)}>{c.nombre}</button>
      </li>)}
    </ul>}
  </div>;
}
