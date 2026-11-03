"use client";

import { useState } from "react";
import { textoFranja as obtenerTextoFranja } from "@/lib/franjas";
import { Search, X, Truck, Calendar } from "lucide-react";
import Desplegable from "@/components/Desplegable";

// Pantalla "Recorrido de camiones" / "Mi recorrido". Es la misma para todos los
// roles; lo que cambia es de dónde salen los datos y qué acciones se permiten.
export default function RecorridoVista({
  esTecnico,
  esAdmin,
  tecnicos,
  tecnicoSeleccionado,
  setTecnicoSeleccionado,
  fecha,
  setFecha,
  onBuscar,
  trabajos,
  cargando,
  puedeCambiarPrioridad,
  onCambiarPrioridad,
  onQuitar,
  onAnular,
}: {
  esTecnico: boolean;
  esAdmin: boolean;
  tecnicos: any[];
  tecnicoSeleccionado: string;
  setTecnicoSeleccionado: (v: string) => void;
  fecha: string;
  setFecha: (v: string) => void;
  onBuscar: () => void;
  trabajos: any[];
  cargando: boolean;
  puedeCambiarPrioridad: boolean;
  onCambiarPrioridad: (t: any, prioridad: number | null, cerrar: () => void) => void | Promise<void>;
  onQuitar: (t: any, cerrar: () => void) => void | Promise<void>;
  onAnular: (t: any, cerrar: () => void) => void | Promise<void>;
}) {
  const [trabajoModal, setTrabajoModal] = useState<any | null>(null);
  const [nuevaPrioridad, setNuevaPrioridad] = useState<string>("");

  return (
    <>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          {esTecnico
            ? "Mi recorrido"
            : "Recorrido de camiones"}
        </h1>

        {/* FILTROS DE BÚSQUEDA */}
        <div className="mx-auto max-w-2xl bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between mb-10">
          {!esTecnico && (
          <div className="w-full">
            <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase flex items-center gap-1.5">
              <Truck size={14} /> Seleccionar Camión / Técnico
            </label>
            <Desplegable
            value={tecnicoSeleccionado}
            onChange={setTecnicoSeleccionado}
            className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium outline-none focus:border-blue-500 bg-white"
            ariaLabel="Seleccionar Camión / Técnico"
            placeholder="Seleccionar camión..."
            opciones={[
            { value: "", label: "Seleccionar camión..." },
            ...tecnicos.map((t) => ({ value: String(t.id), label: `🚛 ${t.nombre} ${t.apellido || ""}` })),
            ]}
            />
          </div>
          )}

          <div className="w-full">
            <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase flex items-center gap-1.5">
              <Calendar size={14} /> Fecha
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium outline-none focus:border-blue-500 bg-white"
            />
          </div>

          <button
            onClick={onBuscar}
            disabled={!tecnicoSeleccionado}
            className="w-full md:w-auto mt-5 bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Search size={16} /> Buscar
          </button>
        </div>

        {/* REJILLA DE TRABAJOS */}
        {cargando ? (
          <p className="text-center text-sm text-slate-400">Buscando asignaciones...</p>
        ) : trabajos.length === 0 ? (
          <div className="text-center bg-white p-10 rounded-xl max-w-md mx-auto shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500">
              {esTecnico
                ? "No tenés trabajos asignados en la fecha seleccionada."
                : tecnicoSeleccionado
                ? "No hay trabajos asignados para este camión en la fecha seleccionada."
                : "Seleccioná un camión y presioná Buscar para ver su recorrido."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {trabajos.map((t) => (
              <div
                key={t._clave}
                onClick={() => {
                  setTrabajoModal(t);
                  setNuevaPrioridad(
                    t.prioridad ? String(t.prioridad) : ""
                  );
                }}
                className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md cursor-pointer transition flex flex-col justify-between hover:border-blue-400"
              >
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      #{t.numero || t.id}
                    </span>
                    <span className="text-xs font-semibold uppercase text-slate-400">
                      {t.localidad || "Sin Localidad"}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 line-clamp-1">
                    {t.direccion || "Sin Dirección"}
                  </p>

                  <h3 className="text-lg font-bold text-slate-800 mt-2">
                    {t.cliente_nombre || "Cliente sin nombre"}
                  </h3>

                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {t.tipo_visita || "Instalación / Medición"}
                  </p>

                  <p className="text-xs text-blue-600 mt-2 font-semibold">
                    {obtenerTextoFranja(t.horario_desde, t.horario_hasta)}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-700">
                    {t.prioridad
                      ? `Prioridad: ${t.prioridad}`
                      : "Sin prioridad"}
                  </span>
                  <span className="text-blue-500 font-semibold">Detalles →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL DE DETALLE Y ACCIONES */}
        {trabajoModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl relative">
              <button
                onClick={() => setTrabajoModal(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>

              <h2 className="text-3xl font-bold text-slate-900">
                {trabajoModal.cliente_nombre || "Cliente"}
              </h2>
              <p className="text-lg font-medium text-slate-700 mt-1">
                {trabajoModal.direccion} {trabajoModal.localidad ? `- ${trabajoModal.localidad}` : ""}
              </p>

              <div className="mt-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p className="text-xs font-semibold text-slate-400 uppercase">Horario pactado</p>
                <p className="text-sm font-semibold text-slate-700 mt-1">
                  {obtenerTextoFranja(trabajoModal.horario_desde, trabajoModal.horario_hasta)}
                </p>
              </div>

              <div className="mt-4">
                <p className="text-sm font-bold text-slate-800">
                  Detalles de la solicitud:{" "}
                  <span className="font-normal text-slate-600">
                    {trabajoModal.observaciones || "Sin observaciones adicionales."}
                  </span>
                </p>
              </div>

              {/* SELECTOR DE PRIORIDADES DEL 1 AL 5 (no aplica al técnico) */}
              {!esTecnico && (
              <div className="mt-6">
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Cambiar prioridad
                </label>
                <Desplegable
                value={nuevaPrioridad}
                onChange={setNuevaPrioridad}
                className="w-full border border-slate-200 rounded-xl p-3 text-slate-700 text-sm outline-none bg-white"
                ariaLabel="Cambiar prioridad"
                placeholder="Seleccionar prioridad..."
                opciones={[
                { value: "", label: "Seleccionar prioridad..." },
                ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Prioridad: ${n}` })),
                { value: "", label: "Sin prioridad" },
                ]}
                />
              </div>
              )}

              {/* BOTONES DE ACCIÓN */}
              <div className="mt-8 flex flex-wrap justify-end gap-3">
                {esAdmin && (
                <button
                  onClick={() => onQuitar(trabajoModal, () => setTrabajoModal(null))}
                  className="bg-amber-100 text-amber-900 border border-amber-200 px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-200 transition"
                >
                  Remover técnico y fecha
                </button>
                )}
                {esAdmin && (
                <button
                  onClick={() => onAnular(trabajoModal, () => setTrabajoModal(null))}
                  className="bg-rose-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-rose-600 transition"
                >
                  Anular visita
                </button>
                )}
                {!esTecnico && (
                <button
                  onClick={() => onCambiarPrioridad(trabajoModal, nuevaPrioridad ? Number(nuevaPrioridad) : null, () => setTrabajoModal(null))}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition"
                >
                  Cambiar prioridad
                </button>
                )}
              </div>
            </div>
          </div>
        )}
    </>
  );
}
