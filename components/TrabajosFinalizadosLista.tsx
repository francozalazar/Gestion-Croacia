"use client";

import { useMemo, useState } from "react";
import { rangoFinalizados } from "@/lib/finalizados";
import Link from "next/link";

export type TrabajoInstalado = {
  id: number; // id de la visita (solicitudes), abre el remito del tecnico
  pedido: number | string | null;
  cliente: string;
  direccion: string;
  fechaInstalacion: string | null; // fecha_finalizacion registrada por el tecnico
  tecnico: string;
  aviso?: string;
};

const TZ = "America/Argentina/Buenos_Aires";

function diaLindo(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("es-AR", { timeZone: TZ });
}

export default function TrabajosFinalizadosLista({
  trabajos, desde = "", hasta = "", buscado = false,
}: {
  trabajos: TrabajoInstalado[]; desde?: string; hasta?: string; buscado?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [inicio, setInicio] = useState(desde);
  const [fin, setFin] = useState(hasta);

  const filtrados = useMemo(() => {
    const t = texto.trim().toLowerCase();
    return trabajos.filter((x) => {
      if (!t) return true;
      return (
        x.cliente.toLowerCase().includes(t) ||
        x.direccion.toLowerCase().includes(t) ||
        String(x.pedido ?? "").includes(t)
      );
    });
  }, [trabajos, texto]);

  return (
    <>
      <form action="/trabajos-finalizados" className="mb-6 flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-5">
        <label className="min-w-0 flex-1 text-sm text-slate-600">Desde
          <input type="date" name="desde" aria-label="Desde" required value={inicio} onChange={e => setInicio(e.target.value)} className="mt-2 block w-full rounded border border-slate-300 px-3 py-3" />
        </label>
        <label className="min-w-0 flex-1 text-sm text-slate-600">Hasta
          <input type="date" name="hasta" aria-label="Hasta" required min={inicio || undefined} value={fin} onChange={e => setFin(e.target.value)} className="mt-2 block w-full rounded border border-slate-300 px-3 py-3" />
        </label>
        <button type="submit" disabled={!rangoFinalizados(inicio, fin)} className="rounded bg-blue-600 px-6 py-3 font-medium text-white disabled:bg-slate-200 disabled:text-slate-400">Buscar</button>
        {inicio && fin && inicio > fin && <p role="alert" className="w-full text-sm text-red-700">Desde no puede ser posterior a Hasta.</p>}
      </form>
      {buscado && <input value={texto} onChange={e => setTexto(e.target.value)} placeholder="Filtrar por cliente, dirección o pedido" aria-label="Filtrar resultados" className="mb-4 w-full rounded border border-slate-300 px-3 py-2" />}
      {!buscado ? <p className="text-sm text-slate-500">Elegí Desde y Hasta y presioná Buscar.</p> :
      filtrados.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          No hay trabajos finalizados para mostrar.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="hidden grid-cols-[90px_minmax(0,1.2fr)_minmax(0,1.4fr)_140px_minmax(0,1fr)_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 lg:grid">
            <span>Pedido</span>
            <span>Cliente</span>
            <span>Dirección</span>
            <span>Finalización registrada</span>
            <span>Técnico</span>
            <span className="text-right">Remito</span>
          </div>
          <ul className="divide-y divide-slate-100">
            {filtrados.map((x) => (
              <li
                key={x.id}
                className="grid gap-2 px-5 py-4 text-sm lg:grid-cols-[90px_minmax(0,1.2fr)_minmax(0,1.4fr)_140px_minmax(0,1fr)_auto] lg:items-center lg:gap-4"
              >
                <span className="font-bold text-slate-900">
                  <span className="text-xs font-medium text-slate-400 lg:hidden">Pedido </span>
                  #{x.pedido ?? "-"}
                </span>
                <span className="min-w-0">
                  <span className="block break-words font-semibold text-slate-800">{x.cliente}</span>
                  {x.aviso && (
                    <span className="mt-1 block border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800">
                      Revisar: {x.aviso}
                    </span>
                  )}
                </span>
                <span className="break-words text-slate-700">{x.direccion || "-"}</span>
                <span className="text-slate-700">
                  <span className="text-xs text-slate-400 lg:hidden">Finalización registrada: </span>
                  {diaLindo(x.fechaInstalacion)}
                </span>
                <span className="break-words text-slate-600">{x.tecnico || "-"}</span>
                <span className="lg:text-right">
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
