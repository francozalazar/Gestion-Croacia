"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

type Trabajo = {
  id: number;
  numero: number | string | null;
  clienteNombre: string;
  direccion: string;
  localidad: string;
  trabajoRealizado: string;
  fechaFinalizacion: string | null;
};

type Props = {
  trabajos: Trabajo[];
};

export default function FinalizadosLista({ trabajos }: Props) {
  const [busqueda, setBusqueda] = useState("");

  const trabajosFiltrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    if (!texto) {
      return trabajos;
    }

    return trabajos.filter((trabajo) => {
      const cliente = trabajo.clienteNombre.toLowerCase();
      const direccion = trabajo.direccion.toLowerCase();
      const localidad = trabajo.localidad.toLowerCase();

      return (
        cliente.includes(texto) ||
        direccion.includes(texto) ||
        localidad.includes(texto)
      );
    });
  }, [trabajos, busqueda]);

  return (
    <>
      {/* BUSCADOR */}
      <div className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-2">
          <label className="text-sm font-semibold text-slate-700">
            Buscar trabajo
          </label>

          <p className="mt-1 text-xs text-slate-500">
            Podés buscar por nombre del cliente, dirección o localidad.
          </p>
        </div>

        <div className="relative mt-4">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Ej: Juan Pérez, Av. Mitre 1234..."
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
          />

          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              title="Limpiar búsqueda"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {busqueda && (
          <p className="mt-3 text-xs text-slate-500">
            {trabajosFiltrados.length}{" "}
            {trabajosFiltrados.length === 1
              ? "resultado encontrado"
              : "resultados encontrados"}
          </p>
        )}
      </div>

      {/* SIN TRABAJOS */}
      {trabajos.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-700">
            No hay trabajos finalizados
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Cuando un técnico termine un trabajo, aparecerá acá.
          </p>
        </div>
      ) : trabajosFiltrados.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <p className="text-lg font-semibold text-slate-700">
            No encontramos trabajos
          </p>

          <p className="mt-2 text-sm text-slate-500">
            Probá buscando por otro nombre, dirección o localidad.
          </p>

          <button
            type="button"
            onClick={() => setBusqueda("")}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        /* LISTA */
        <div className="space-y-4">
          {trabajosFiltrados.map((trabajo) => (
            <div
              key={trabajo.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">

                {/* INFORMACIÓN */}
                <div className="space-y-4">

                  {/* TÍTULO Y ESTADO */}
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-lg font-bold text-slate-900">
                      Trabajo #{trabajo.id}
                    </h2>

                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                      FINALIZADO
                    </span>
                  </div>

                  {/* CLIENTE */}
                  <div>
                    <p className="text-sm text-slate-500">
                      Cliente
                    </p>

                    <p className="font-semibold text-slate-900">
                      {trabajo.clienteNombre}
                    </p>
                  </div>

                  {/* DIRECCIÓN */}
                  <div>
                    <p className="text-sm text-slate-500">
                      Dirección
                    </p>

                    <p className="text-sm font-medium text-slate-800">
                      {trabajo.direccion || "Sin dirección"}
                    </p>

                    {trabajo.localidad && (
                      <p className="text-sm text-slate-500">
                        {trabajo.localidad}
                      </p>
                    )}
                  </div>

                  {/* TRABAJO REALIZADO */}
                  <div>
                    <p className="text-sm text-slate-500">
                      Trabajo realizado
                    </p>

                    <p className="max-w-2xl whitespace-pre-wrap text-sm text-slate-700">
                      {trabajo.trabajoRealizado || "Sin detalle"}
                    </p>
                  </div>

                  {/* FECHA */}
                  {trabajo.fechaFinalizacion && (
                    <p className="text-xs text-slate-500">
                      Finalizado:{" "}
                      {new Date(
                        trabajo.fechaFinalizacion
                      ).toLocaleString("es-AR")}
                    </p>
                  )}
                </div>

                {/* BOTONES */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/mis-trabajos/${trabajo.id}`}
                    className="rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Ver trabajo
                  </Link>

                  <Link
                    href={`/finalizados/${trabajo.id}`}
                    className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Ver comprobante
                  </Link>
                </div>

              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}