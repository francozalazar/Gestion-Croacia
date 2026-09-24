"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/cliente";
import {
  crearVentaAction,
  editarTotalVentaAction,
  cargarPagoAction,
} from "./actions";

type Direccion = { id: number; direccion: string; localidad: string | null };
type Pago = {
  id: number;
  monto: number;
  fecha: string;
  medio: string | null;
  facturado: boolean;
  factura_url: string | null;
};
type Venta = {
  id: number;
  direccion_id: number | null;
  descripcion: string | null;
  total: number;
  created_at: string;
  solicitud_id: number | null;
  solicitud_fabrica_id: number | null;
  pagos: Pago[];
};
type Visita = {
  id: number;
  numero?: number | null;
  numero_remito?: number | null;
  direccion: string | null;
  localidad: string | null;
  fecha: string | null;
  estado: string;
  tipo_visita?: string | null;
  observaciones: string | null;
  created_at: string | null;
};

function plata(n: number) {
  return "$ " + Number(n || 0).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function fechaLinda(f: string | null | undefined) {
  if (!f) return "-";
  return new Date(f).toLocaleDateString("es-AR");
}

const inputCls =
  "w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400";

export default function ClienteFicha({
  cliente,
  direcciones,
  ventas,
  solicitudes,
  remitos,
}: {
  cliente: any;
  direcciones: Direccion[];
  ventas: Venta[];
  solicitudes: Visita[];
  remitos: Visita[];
}) {
  const supabase = createClient();

  const [mostrarNuevaVenta, setMostrarNuevaVenta] = useState(false);
  const [dirElegida, setDirElegida] = useState("");
  const [nuevaDireccion, setNuevaDireccion] = useState("");
  const [nuevaLocalidad, setNuevaLocalidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [total, setTotal] = useState("");

  const [pagoAbierto, setPagoAbierto] = useState<number | null>(null);
  const [monto, setMonto] = useState("");
  const [fechaPago, setFechaPago] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [medio, setMedio] = useState("Efectivo");
  const [conFactura, setConFactura] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const [editandoTotal, setEditandoTotal] = useState<number | null>(null);
  const [totalEdicion, setTotalEdicion] = useState("");

  const dirPorId = useMemo(() => {
    const map: Record<number, Direccion> = {};
    direcciones.forEach((d) => (map[d.id] = d));
    return map;
  }, [direcciones]);

  function textoDireccion(d: Direccion | undefined, fallbackDir?: string | null, fallbackLoc?: string | null) {
    if (d) return d.direccion + (d.localidad ? ` - ${d.localidad}` : "");
    if (fallbackDir) return fallbackDir + (fallbackLoc ? ` - ${fallbackLoc}` : "");
    return "Sin dirección";
  }

  const ventasPorDireccion = useMemo(() => {
    const grupos: Record<string, Venta[]> = {};
    ventas.forEach((v) => {
      const key = textoDireccion(v.direccion_id ? dirPorId[v.direccion_id] : undefined);
      (grupos[key] = grupos[key] || []).push(v);
    });
    return grupos;
  }, [ventas, dirPorId]);

  const historial = useMemo(() => {
    const items = [
      ...solicitudes.map((s) => ({ ...s, tipo: "visita" as const })),
      ...remitos.map((r) => ({ ...r, tipo: "remito" as const })),
    ].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

    const grupos: Record<string, typeof items> = {};
    items.forEach((it) => {
      const dir = direcciones.find(
        (d) =>
          it.direccion &&
          d.direccion.trim().toLowerCase() === it.direccion.trim().toLowerCase()
      );
      const key = dir
        ? textoDireccion(dir)
        : it.direccion
        ? it.direccion + (it.localidad ? ` - ${it.localidad}` : "")
        : "Sin dirección";
      (grupos[key] = grupos[key] || []).push(it);
    });
    return grupos;
  }, [solicitudes, remitos, direcciones]);

  const totalCliente = ventas.reduce((a, v) => a + Number(v.total || 0), 0);
  const pagadoCliente = ventas.reduce(
    (a, v) => a + v.pagos.reduce((x, p) => x + Number(p.monto || 0), 0),
    0
  );

  async function subirFactura(ventaId: number): Promise<string | null> {
    if (!archivo) return null;
    const path = `${ventaId}/${Date.now()}.pdf`;
    const { error } = await supabase.storage
      .from("facturas")
      .upload(path, archivo, { contentType: "application/pdf" });
    if (error) {
      alert("No se pudo subir la factura: " + error.message);
      return null;
    }
    return path;
  }

  async function verFactura(path: string) {
    const { data, error } = await supabase.storage
      .from("facturas")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) {
      alert("No se pudo abrir la factura.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/clientes" className="text-sm text-slate-500 hover:text-slate-800">
        ← Volver a clientes
      </Link>

      <div className="mt-3 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{cliente.nombre}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {cliente.direccion || "Sin dirección principal"}
            {cliente.localidad ? ` - ${cliente.localidad}` : ""}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="text-slate-500">
            Total vendido: <strong className="text-slate-900">{plata(totalCliente)}</strong>
          </p>
          <p className="text-slate-500">
            Falta cobrar:{" "}
            <strong className={totalCliente - pagadoCliente > 0 ? "text-red-600" : "text-emerald-600"}>
              {plata(totalCliente - pagadoCliente)}
            </strong>
          </p>
        </div>
      </div>

      {/* VENTAS */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Ventas</h2>
          <button
            onClick={() => setMostrarNuevaVenta(!mostrarNuevaVenta)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            {mostrarNuevaVenta ? "Cancelar" : "+ Nueva venta"}
          </button>
        </div>

        {mostrarNuevaVenta && (
          <form
            action={async (fd) => {
              await crearVentaAction(fd);
              setMostrarNuevaVenta(false);
              setDescripcion("");
              setTotal("");
              setDirElegida("");
              setNuevaDireccion("");
              setNuevaLocalidad("");
            }}
            className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <input type="hidden" name="clienteId" value={cliente.id} />
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Dirección
                </label>
                <select
                  name="direccionId"
                  value={dirElegida}
                  onChange={(e) => setDirElegida(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Nueva dirección...</option>
                  {direcciones.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.direccion}
                      {d.localidad ? ` (${d.localidad})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              {dirElegida === "" && (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Nueva dirección
                    </label>
                    <input
                      name="nuevaDireccion"
                      value={nuevaDireccion}
                      onChange={(e) => setNuevaDireccion(e.target.value)}
                      placeholder="Ej: Av. Mitre 1234"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                      Localidad
                    </label>
                    <input
                      name="nuevaLocalidad"
                      value={nuevaLocalidad}
                      onChange={(e) => setNuevaLocalidad(e.target.value)}
                      placeholder="Ej: Quilmes"
                      className={inputCls}
                    />
                  </div>
                </>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Qué es
                </label>
                <input
                  name="descripcion"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder='Ej: "2 cortinas local Lanús"'
                  className={inputCls}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                  Total *
                </label>
                <input
                  name="total"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Guardar venta
              </button>
            </div>
          </form>
        )}

        {ventas.length === 0 && !mostrarNuevaVenta && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Todavía no hay ventas cargadas.
          </div>
        )}

        {Object.entries(ventasPorDireccion).map(([dir, lista]) => (
          <div key={dir} className="mb-6">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              {dir}
            </h3>
            <div className="grid gap-4">
              {lista.map((v) => {
                const pagado = v.pagos.reduce((a, p) => a + Number(p.monto || 0), 0);
                const facturado = v.pagos
                  .filter((p) => p.facturado)
                  .reduce((a, p) => a + Number(p.monto || 0), 0);
                const falta = Number(v.total || 0) - pagado;

                return (
                  <div
                    key={v.id}
                    className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">
                          {v.descripcion || "Venta"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {fechaLinda(v.created_at)}
                        </p>
                        {v.solicitud_fabrica_id ? (
                          <Link
                            href={`/remitos/${v.solicitud_fabrica_id}`}
                            className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Ver remito →
                          </Link>
                        ) : v.solicitud_id ? (
                          <Link
                            href={`/finalizados/${v.solicitud_id}`}
                            className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:underline"
                          >
                            Ver visita →
                          </Link>
                        ) : null}
                      </div>
                      {editandoTotal === v.id ? (
                        <form
                          action={async (fd) => {
                            await editarTotalVentaAction(fd);
                            setEditandoTotal(null);
                          }}
                          className="flex items-center gap-2"
                        >
                          <input type="hidden" name="ventaId" value={v.id} />
                          <input type="hidden" name="clienteId" value={cliente.id} />
                          <input
                            name="total"
                            type="number"
                            min="0"
                            step="0.01"
                            value={totalEdicion}
                            onChange={(e) => setTotalEdicion(e.target.value)}
                            className="w-32 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                          />
                          <button
                            type="submit"
                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                          >
                            OK
                          </button>
                        </form>
                      ) : (
                        <button
                          onClick={() => {
                            setEditandoTotal(v.id);
                            setTotalEdicion(String(v.total));
                          }}
                          className="text-lg font-bold text-slate-900 hover:text-blue-600"
                          title="Tocar para editar el total"
                        >
                          {plata(v.total)}
                        </button>
                      )}
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                      <p className="text-slate-500">
                        Pagado:{" "}
                        <strong className="text-emerald-700">{plata(pagado)}</strong>
                      </p>
                      <p className="text-slate-500">
                        Falta:{" "}
                        <strong className={falta > 0 ? "text-red-600" : "text-emerald-700"}>
                          {plata(falta)}
                        </strong>
                      </p>
                      <p className="text-slate-500">
                        Facturado: <strong className="text-slate-800">{plata(facturado)}</strong>
                      </p>
                      <p className="text-slate-500">
                        Falta facturar:{" "}
                        <strong className="text-slate-800">{plata(pagado - facturado)}</strong>
                      </p>
                    </div>

                    {v.pagos.length > 0 && (
                      <div className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
                        {v.pagos.map((p) => (
                          <div
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600"
                          >
                            <span>
                              {fechaLinda(p.fecha)} — {plata(p.monto)}
                              {p.medio ? ` (${p.medio})` : ""}
                            </span>
                            <span className="flex items-center gap-2">
                              {p.facturado && (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">
                                  Facturado
                                </span>
                              )}
                              {p.factura_url && (
                                <button
                                  onClick={() => verFactura(p.factura_url!)}
                                  className="font-semibold text-blue-600 hover:underline"
                                >
                                  Ver factura
                                </button>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4">
                      {pagoAbierto === v.id ? (
                        <form
                          action={async (fd) => {
                            setSubiendo(true);
                            let facturaUrl: string | null = null;
                            if (conFactura && archivo) {
                              facturaUrl = await subirFactura(v.id);
                              if (conFactura && archivo && !facturaUrl) {
                                setSubiendo(false);
                                return;
                              }
                            }
                            fd.set("facturaUrl", facturaUrl || "");
                            await cargarPagoAction(fd);
                            setSubiendo(false);
                            setPagoAbierto(null);
                            setMonto("");
                            setConFactura(false);
                            setArchivo(null);
                          }}
                          className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <input type="hidden" name="ventaId" value={v.id} />
                          <input type="hidden" name="clienteId" value={cliente.id} />
                          <div className="grid gap-3 md:grid-cols-3">
                            <input
                              name="monto"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              placeholder="Monto"
                              value={monto}
                              onChange={(e) => setMonto(e.target.value)}
                              className={inputCls}
                            />
                            <input
                              name="fecha"
                              type="date"
                              value={fechaPago}
                              onChange={(e) => setFechaPago(e.target.value)}
                              className={inputCls}
                            />
                            <select
                              name="medio"
                              value={medio}
                              onChange={(e) => setMedio(e.target.value)}
                              className={inputCls}
                            >
                              <option>Efectivo</option>
                              <option>Transferencia</option>
                              <option>Cheque</option>
                              <option>Otro</option>
                            </select>
                          </div>
                          <label className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                            <input
                              type="checkbox"
                              name="facturado"
                              checked={conFactura}
                              onChange={(e) => setConFactura(e.target.checked)}
                            />
                            Facturar este pago (subir factura en PDF)
                          </label>
                          {conFactura && (
                            <input
                              type="file"
                              accept="application/pdf"
                              onChange={(e) =>
                                setArchivo(e.target.files?.[0] || null)
                              }
                              className="mt-2 text-sm text-slate-600"
                            />
                          )}
                          <div className="mt-3 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setPagoAbierto(null)}
                              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={subiendo}
                              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              {subiendo ? "Guardando..." : "Guardar pago"}
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          onClick={() => setPagoAbierto(v.id)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          + Cargar pago
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {/* HISTORIAL */}
      <section>
        <h2 className="mb-4 text-lg font-bold text-slate-900">Historial</h2>
        {Object.keys(historial).length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No hay visitas ni remitos todavía.
          </div>
        ) : (
          Object.entries(historial).map(([dir, items]) => (
            <div key={dir} className="mb-6">
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                {dir}
              </h3>
              <div className="space-y-2">
                {items.map((it) => (
                  <Link
                    key={`${it.tipo}-${it.id}`}
                    href={
                      it.tipo === "remito"
                        ? `/remitos/${it.id}`
                        : `/finalizados/${it.id}`
                    }
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 transition hover:border-slate-300 hover:shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          it.tipo === "remito"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {it.tipo === "remito"
                          ? `Remito #${it.numero_remito || it.id}`
                          : `Visita #${it.numero || it.id}`}
                      </span>
                      <span className="text-sm text-slate-700">
                        {it.tipo === "visita" && it.tipo_visita
                          ? it.tipo_visita
                          : it.tipo === "remito"
                          ? "Pedido de fábrica"
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{fechaLinda(it.created_at)}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium">
                        {it.estado.replaceAll("_", " ")}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
