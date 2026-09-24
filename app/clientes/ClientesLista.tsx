"use client";

import { useState } from "react";
import Link from "next/link";

type Cliente = {
  id: number;
  nombre: string;
  direccion: string | null;
  localidad: string | null;
};

function plata(n: number) {
  return "$ " + n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
}

export default function ClientesLista({
  clientes,
  deudaPorCliente,
}: {
  clientes: Cliente[];
  deudaPorCliente: Record<number, number>;
}) {
  const [busqueda, setBusqueda] = useState("");

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <>
      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar cliente..."
        className="mb-6 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
      />

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
          No hay clientes para mostrar.
        </div>
      ) : (
        <div className="grid gap-3">
          {filtrados.map((c) => {
            const deuda = deudaPorCliente[c.id] || 0;
            return (
              <Link
                key={c.id}
                href={`/clientes/${c.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-slate-300 hover:shadow"
              >
                <div>
                  <p className="font-semibold text-slate-900">{c.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {c.direccion || "Sin dirección"}
                    {c.localidad ? ` - ${c.localidad}` : ""}
                  </p>
                </div>
                {deuda > 0 ? (
                  <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                    Debe {plata(deuda)}
                  </span>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    Al día
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
