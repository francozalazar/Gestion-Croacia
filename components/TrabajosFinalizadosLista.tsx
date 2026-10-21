"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export type TrabajoInstalado = {
  id: number; // id de la visita (solicitudes), abre el remito del tecnico
  pedido: number | string | null;
  cliente: string;
  direccion: string;
  fechaInstalacion: string | null; // fecha_finalizacion registrada por el tecnico
  tecnico: string;
};

const TZ = "America/Argentina/Buenos_Aires";

function diaISO(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
}

function diaLindo(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ });
}

export default function TrabajosFinalizadosLista({
  trabajos,
}: {
  trabajos: TrabajoInstalado[];
}) {
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return trabajos.filter((x) => {
      if (fecha && diaISO(x.fechaInstalacion) !== fecha) return false;
      if (!t) return true;
      return (
        x.cliente.toLowerCase().includes(t) ||
        x.direccion.toLowerCase().includes(t) ||
        String(x.pedido ?? "").includes(t)
      );
    });
  }, [trabajos, texto, fecha]);

  return (
    <>
      <div className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_200px_auto]">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por cliente, dirección o número de pedido"
          className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
        />
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          aria-label="Fecha de instalación"
          className="w-full border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-slate-900"
        />
        <button
          type="button"
          onClick={() => {
            setTexto("");
            setFecha("");
          }}
          className="border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Limpiar
        </button>
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No hay trabajos instalados para mostrar.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="hidden grid-cols-[90px_1.2fr_1.4fr_120px_1fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Dirección</span>
            <span>Instalado</span>
            <span>Técnico</span>
            <span className="text-right">Remito</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {filtrados.map((x) => (
              <li
                key={x.id}
                className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[90px_1.2fr_1.4fr_120px_1fr_auto] md:items-center md:gap-4"
              >
                <span className="font-bold text-slate-900">
                  <span className="text-xs font-medium text-slate-400 md:hidden">Pedido </span>
                  #{x.pedido ?? "-"}
                </span>
                <span className="truncate font-semibold text-slate-800">{x.cliente}</span>
                <span className="truncate text-slate-700">{x.direccion || "-"}</span>
                <span className="text-slate-700">
                  <span className="text-xs text-slate-400 md:hidden">Instalado: </span>
                  {diaLindo(x.fechaInstalacion)}
                </span>
                <span className="truncate text-slate-600">{x.tecnico || "-"}</span>
                <span className="md:text-right">
                  <Link
                    href={`/finalizados/${x.id}`}
                    className="inline-block border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    Ver remito
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
