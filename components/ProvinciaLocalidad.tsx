"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { CABA, PROVINCIAS, LOCALIDADES_POR_PROVINCIA } from "@/lib/geo";

// Normaliza para buscar: sin mayúsculas, sin acentos y ñ -> n.
function normalizar(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// Alias para encontrar CABA escribiendo "caba" o "capital".
const ALIAS_PROVINCIA: Record<string, string> = {
  caba: CABA,
  capital: CABA,
  "capital federal": CABA,
};

const MAX_VISIBLES = 60;

function Opciones({
  opciones,
  onElegir,
  notaVacia,
}: {
  opciones: string[];
  onElegir: (v: string) => void;
  notaVacia: string;
}) {
  if (opciones.length === 0) {
    return (
      <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-400 shadow-lg">
        {notaVacia}
      </div>
    );
  }
  return (
    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
      {opciones.slice(0, MAX_VISIBLES).map((o) => (
        <button
          key={o}
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onElegir(o);
          }}
          className="block w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
        >
          {o}
        </button>
      ))}
      {opciones.length > MAX_VISIBLES && (
        <p className="px-4 py-2 text-xs text-slate-400">
          y {opciones.length - MAX_VISIBLES} más... seguí escribiendo para
          filtrar
        </p>
      )}
    </div>
  );
}

export default function ProvinciaLocalidad({
  localidad,
  setLocalidad,
  inputClassName,
}: {
  localidad: string;
  setLocalidad: (v: string) => void;
  inputClassName: string;
}) {
  const [provincia, setProvincia] = useState("");
  const [textoProvincia, setTextoProvincia] = useState("");
  const [provAbierto, setProvAbierto] = useState(false);
  const [locAbierto, setLocAbierto] = useState(false);
  const ignorarBlurProv = useRef(false);
  const ignorarBlurLoc = useRef(false);

  const provinciasFiltradas = useMemo(() => {
    const t = normalizar(textoProvincia.trim());
    if (!t) return PROVINCIAS;
    const alias = ALIAS_PROVINCIA[t];
    return PROVINCIAS.filter(
      (p) => normalizar(p).includes(t) || p === alias
    );
  }, [textoProvincia]);

  const localidades = useMemo(
    () => (provincia ? LOCALIDADES_POR_PROVINCIA[provincia] || [] : []),
    [provincia]
  );

  const localidadesFiltradas = useMemo(() => {
    const t = normalizar(localidad.trim());
    if (!t) return localidades;
    return localidades.filter((l) => normalizar(l).includes(t));
  }, [localidades, localidad]);

  function elegirProvincia(p: string) {
    const anterior = provincia;
    setProvincia(p);
    setTextoProvincia(p);
    setProvAbierto(false);
    // Si la localidad cargada venía del catálogo de la provincia anterior,
    // se limpia para no mezclar provincias. El texto libre se conserva.
    if (anterior && anterior !== p) {
      const listaAnterior = LOCALIDADES_POR_PROVINCIA[anterior] || [];
      const actual = normalizar(localidad.trim());
      if (actual && listaAnterior.some((l) => normalizar(l) === actual)) {
        setLocalidad("");
      }
    }
  }

  const esCaba = provincia === CABA;

  return (
    <>
      <div className="relative">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Provincia
        </label>
        <input
          value={textoProvincia}
          onChange={(e) => {
            setTextoProvincia(e.target.value);
            setProvincia("");
            setProvAbierto(true);
          }}
          onFocus={() => setProvAbierto(true)}
          onBlur={() => {
            if (!ignorarBlurProv.current) setProvAbierto(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && provAbierto) {
              e.preventDefault();
              if (provinciasFiltradas.length > 0)
                elegirProvincia(provinciasFiltradas[0]);
            }
            if (e.key === "Escape") setProvAbierto(false);
          }}
          placeholder="Ej: Buenos Aires, CABA..."
          className={inputClassName}
          autoComplete="off"
        />
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-4 top-[42px] text-slate-400"
        />
        {provAbierto && (
          <div
            onMouseDown={() => {
              ignorarBlurProv.current = true;
              setTimeout(() => (ignorarBlurProv.current = false), 200);
            }}
          >
            <Opciones
              opciones={provinciasFiltradas}
              onElegir={elegirProvincia}
              notaVacia="No coincide con ninguna provincia."
            />
          </div>
        )}
      </div>

      <div className="relative">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          {esCaba ? "Barrio" : "Localidad"}
        </label>
        <input
          value={localidad}
          onChange={(e) => {
            setLocalidad(e.target.value);
            setLocAbierto(true);
          }}
          onFocus={() => setLocAbierto(true)}
          onBlur={() => {
            if (!ignorarBlurLoc.current) setLocAbierto(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && locAbierto && provincia) {
              e.preventDefault();
              if (localidadesFiltradas.length > 0)
                setLocalidad(localidadesFiltradas[0]);
              setLocAbierto(false);
            }
            if (e.key === "Escape") setLocAbierto(false);
          }}
          placeholder={
            provincia
              ? esCaba
                ? "Ej: Caballito, Palermo..."
                : "Ej: Quilmes, Mar del Plata..."
              : "Elegí primero la provincia"
          }
          className={inputClassName}
          autoComplete="off"
        />
        {locAbierto && provincia && (
          <div
            onMouseDown={() => {
              ignorarBlurLoc.current = true;
              setTimeout(() => (ignorarBlurLoc.current = false), 200);
            }}
          >
            <Opciones
              opciones={localidadesFiltradas}
              onElegir={(v) => {
                setLocalidad(v);
                setLocAbierto(false);
              }}
              notaVacia="No está en la lista, pero podés escribirla igual."
            />
          </div>
        )}
      </div>
    </>
  );
}
