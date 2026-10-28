"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

export type OpcionDesplegable = { value: string; label: string };

// Normaliza para buscar: sin mayúsculas y sin acentos (igual que el
// selector de clientes y el de provincia/localidad).
function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Desplegable con buscador: mismo formato en toda la app que Provincia /
// Localidad y el selector de clientes (lista debajo del campo, altura
// acotada con scroll interno). Reemplaza al <select> nativo conservando
// valores, name (input oculto), required, disabled y la cascada de cada
// formulario. Enter nunca dispara el submit del formulario.
export default function Desplegable({
  opciones,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  placeholder = "Seleccionar...",
  className,
  ariaLabel,
  textoVacio = "No hay opciones con ese nombre.",
}: {
  opciones: OpcionDesplegable[];
  value?: string;
  defaultValue?: string;
  onChange?: (valor: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className: string;
  ariaLabel?: string;
  textoVacio?: string;
}) {
  const id = useId();
  const controlado = value !== undefined;
  const [interno, setInterno] = useState(defaultValue ?? "");
  const valor = controlado ? value : interno;
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [activo, setActivo] = useState(-1);
  // Si dos opciones comparten el mismo value (ej. dos opciones vacías), se
  // recuerda la etiqueta de la que eligió el usuario para mostrarla.
  const [etiquetaElegida, setEtiquetaElegida] = useState<{
    valor: string;
    label: string;
  } | null>(null);

  const elegida = opciones.find((o) => o.value === valor);
  const etiqueta =
    etiquetaElegida && etiquetaElegida.valor === valor
      ? etiquetaElegida.label
      : (elegida?.label ?? "");

  const filtradas = useMemo(() => {
    const t = normalizar(texto.trim());
    if (!t) return opciones;
    return opciones.filter((o) => normalizar(o.label).includes(t));
  }, [opciones, texto]);

  function elegir(o: OpcionDesplegable) {
    if (!controlado) setInterno(o.value);
    setEtiquetaElegida({ valor: o.value, label: o.label });
    onChange?.(o.value);
    setTexto("");
    setAbierto(false);
    setActivo(-1);
  }

  return (
    <div
      className="relative min-w-0"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setAbierto(false);
          setActivo(-1);
        }
      }}
    >
      {name && !disabled && <input type="hidden" name={name} value={valor} />}
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={abierto}
        aria-controls={id}
        aria-activedescendant={
          activo >= 0 && abierto ? `${id}-${activo}` : undefined
        }
        autoComplete="off"
        placeholder={placeholder}
        className={className}
        required={required && !disabled}
        disabled={disabled}
        value={abierto ? texto : etiqueta}
        onFocus={() => {
          setTexto("");
          setAbierto(true);
          setActivo(-1);
        }}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
          setActivo(-1);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            setAbierto(false);
            setActivo(-1);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAbierto(true);
            setActivo((i) =>
              Math.max(
                0,
                Math.min(
                  filtradas.length - 1,
                  i + (e.key === "ArrowDown" ? 1 : -1)
                )
              )
            );
            return;
          }
          if (e.key === "Enter") {
            // Nunca dispara el submit del formulario desde el desplegable.
            e.preventDefault();
            if (!abierto) {
              setAbierto(true);
            } else if (activo >= 0 && filtradas[activo]) {
              elegir(filtradas[activo]);
            } else if (texto.trim() && filtradas.length > 0) {
              elegir(filtradas[0]);
            } else {
              setAbierto(false);
              setActivo(-1);
            }
          }
        }}
      />
      <ChevronDown
        size={16}
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
      />
      {abierto && !disabled && (
        <ul
          id={id}
          role="listbox"
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {filtradas.length === 0 && (
            <li className="px-4 py-3 text-sm text-slate-500">{textoVacio}</li>
          )}
          {filtradas.map((o, i) => (
            <li
              key={`${i}-${o.value}`}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === valor}
            >
              <button
                type="button"
                className={`w-full break-words px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 ${
                  i === activo ? "bg-blue-50" : ""
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => elegir(o)}
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
