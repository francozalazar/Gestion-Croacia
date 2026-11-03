"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { operarEncargado } from "./actions";
import { fechaLinda as fechaCivil } from "@/lib/fechasFicha";
import Desplegable from "@/components/Desplegable";
import CabeceraTarjeta from "@/components/TarjetaSolicitud";
import CoordinacionVista from "@/components/CoordinacionVista";
import RecorridoVista from "@/components/RecorridoVista";
import MisTrabajosVista from "@/components/MisTrabajosVista";
import AvisosAndroid from "@/components/AvisosAndroid";
import { Calendar, Bell, ClipboardList, Truck, ArrowRight } from "lucide-react";
import { VerDetallesInstalacion } from "@/components/EnviarACoordinacion";
type Trabajo = {
  id: number;
  numero: number;
  estado: string;
  cliente_nombre: string;
  cliente_telefono?: string;
  direccion: string;
  localidad?: string;
  fecha?: string;
  horario_desde?: string;
  horario_hasta?: string;
  tipo_visita?: string;
  observaciones?: string;
  solicitud_fabrica_id?: number;
};
type Asignacion = {
  id: number;
  usuario_id: string;
  solicitud_id: number | null;
  solicitud_fabrica_id: number | null;
  fecha: string;
  prioridad: number | null;
};
type Datos = {
  tecnicos: { id: string; nombre: string }[];
  asignaciones: Asignacion[];
  visitas: Trabajo[];
  pedidos: Trabajo[];
  motores: { id: number; nombre: string; cantidad: number; minimo: number }[];
};
const campo =
  "w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-medium outline-none focus:border-blue-500";
const etiqueta =
  "block text-xs font-semibold uppercase text-slate-400 mb-1";
const boton =
  "rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50";
function hoyArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
const SECCIONES = [
  "Inicio",
  "Recorrido de camiones",
  "Coordinación",
  "Mi recorrido",
  "Producción",
  "Stock de motores",
  "Instalación",
];
const descripciones: Record<string, string> = {
  "Inicio": "Novedades y notificaciones de tus trabajos de hoy.",
  "Coordinación": "Asigna fecha y técnico responsable para derivar las órdenes a la hoja de ruta de los camiones.",
  "Recorrido de camiones": "Trabajos asignados a cada técnico por día.",
  "Producción": "Qué hay en producción y en qué estado está.",
  "Stock de motores": "Movimientos y stock mínimo de motores.",
  "Mi recorrido": "Lo que tenés asignado para completar.",
  "Instalación": "Pedidos terminados por fábrica. Sólo lectura.",
};
const coord = [
  "PENDIENTE_COORDINACION",
  "COORDINACION",
  "ENVIADO_COORDINACION",
  "ASIGNADO",
  "ASIGNADO_FABRICA",
];
const prod = [
  "ENVIADO_A_CORTAR",
  "EN_CORTE",
  "EN_FABRICACION",
  "EN_FABRICA",
  "FALTANTES",
];
export default function PanelEncargado({
  datos,
  usuarioId,
  seccion,
}: {
  datos: Datos;
  usuarioId: string;
  seccion?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState(
    seccion && SECCIONES.includes(seccion) ? seccion : "Inicio",
  );
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [buscar, setBuscar] = useState("");
  const [tecnico, setTecnico] = useState(datos.tecnicos[0]?.id || "");
  const [fecha, setFecha] = useState(hoyArgentina());
  // Fecha de hoy (Argentina): se vuelve a calcular al volver a la pestaña,
  // para que el formulario no muestre el día de ayer si quedó abierto.
  const [hoy, setHoy] = useState(hoyArgentina());
  useEffect(() => {
    const actualizar = () => setHoy(hoyArgentina());
    document.addEventListener("visibilitychange", actualizar);
    window.addEventListener("focus", actualizar);
    return () => {
      document.removeEventListener("visibilitychange", actualizar);
      window.removeEventListener("focus", actualizar);
    };
  }, []);
  useEffect(() => {
    setTab(seccion && SECCIONES.includes(seccion) ? seccion : "Inicio");
  }, [seccion]);
  const operaciones = useRef<Record<number, string>>({});
  const trabajos = [
    ...datos.visitas
      .filter((x) => !x.solicitud_fabrica_id)
      .map((x) => ({ ...x, fabrica: false })),
    ...datos.pedidos.map((x) => ({ ...x, fabrica: true })),
  ];
  function asignacion(t: Trabajo & { fabrica: boolean }) {
    return datos.asignaciones.find((a) =>
      t.fabrica ? a.solicitud_fabrica_id === t.id : a.solicitud_id === t.id,
    );
  }
  async function ejecutar(accion: string, datos: Record<string, unknown>) {
    if (ocupado) return;
    setOcupado(true);
    setMensaje("");
    try {
      const r = await operarEncargado(accion, datos);
      setMensaje(r.mensaje);
      if (r.ok) {
        if (accion === "stock") delete operaciones.current[Number(datos.motor)];
        router.refresh();
      }
    } catch {
      setMensaje("No se pudo confirmar. Actualizá antes de reintentar.");
    } finally {
      setOcupado(false);
    }
  }
  if (tab === "Inicio") {
    const deHoy = trabajos.filter((t) => {
      const a = asignacion(t);
      return a?.usuario_id === usuarioId && a.fecha === hoy;
    });
    const finalizados = deHoy.filter((t) => t.estado === "FINALIZADO").length;
    const enProd = datos.pedidos;
    const mProd = {
      pendientes: enProd.filter((t) => ["ENVIADO_A_CORTAR", "EN_CORTE"].includes(t.estado)).length,
      enProceso: enProd.filter((t) => ["EN_FABRICACION", "EN_FABRICA"].includes(t.estado)).length,
      faltantes: enProd.filter((t) => t.estado === "FALTANTES").length,
      anulados: enProd.filter((t) => t.estado === "ANULADO").length,
    };
    return (
      <>
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400">Bienvenido nuevamente</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Panel principal</h1>
        </div>
        <AvisosAndroid />
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <Calendar size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Para hoy</h2>
              <p className="text-xs text-slate-400">
                Lo urgente del día, arriba de todo
              </p>
            </div>
          </div>
          {deHoy.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-400">
              Nada urgente para hoy.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {deHoy.slice(0, 6).map((t) => (
                <button
                  key={`hoy-${t.fabrica}-${t.id}`}
                  onClick={() => setTab("Mi recorrido")}
                  className="flex w-full items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-slate-50/60 rounded-lg px-2 -mx-2 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {t.fabrica ? "Remito" : "Visita"} #{t.numero} - {t.cliente_nombre || "Cliente"}
                    </p>
                    <p className="truncate text-xs text-slate-500">{t.direccion || "Sin dirección"}</p>
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-slate-300" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3 mb-8">
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-medium text-slate-400">Asignados para hoy</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{deHoy.length}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-medium text-slate-400">Pendientes de hoy</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{deHoy.length - finalizados}</p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
            <p className="text-xs font-medium text-slate-400">Finalizados de hoy</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{finalizados}</p>
          </div>
        </div>
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                Producción en fábrica
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">Estado de los trabajos</h2>
            </div>
            <button
              onClick={() => setTab("Producción")}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Ver todos
              <ArrowRight size={14} />
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Pendientes</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{mProd.pendientes}</p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-blue-700">En producción</p>
              <p className="mt-2 text-2xl font-bold text-blue-700">{mProd.enProceso}</p>
            </div>
            <div className="rounded-xl bg-amber-50 p-4">
              <p className="text-xs text-amber-700">Faltantes</p>
              <p className="mt-2 text-2xl font-bold text-amber-700">{mProd.faltantes}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-4">
              <p className="text-xs text-red-700">Anulados</p>
              <p className="mt-2 text-2xl font-bold text-red-700">{mProd.anulados}</p>
            </div>
          </div>
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Hola, {datos.tecnicos.find((x) => x.id === usuarioId)?.nombre || "Usuario"}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Panel de trabajo para el rol de <strong className="text-slate-800">ENCARGADO</strong>.
              </p>
            </div>
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Accesos Directos
              </h3>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => setTab("Mi recorrido")}
                  className="flex items-center justify-between rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <span className="flex items-center gap-2"><ClipboardList size={16} /> Ver Mis Trabajos Pendientes</span>
                  <ArrowRight size={14} />
                </button>
                <button
                  onClick={() => setTab("Recorrido de camiones")}
                  className="flex items-center justify-between rounded-xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-semibold hover:bg-slate-200"
                >
                  <span className="flex items-center gap-2"><Truck size={16} /> Consultar Mi Recorrido</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Nuevos Trabajos Asignados</h3>
                  <p className="text-xs text-slate-400">Avisos de tareas listas para realizar</p>
                </div>
              </div>
            </div>
            {deHoy.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No hay notificaciones pendientes en este momento.
              </div>
            ) : (
              <div className="space-y-3">
                {deHoy.map((t) => (
                  <button
                    key={`${t.fabrica}-${t.id}`}
                    onClick={() => setTab("Mi recorrido")}
                    className="flex w-full items-center justify-between p-3.5 rounded-xl border border-slate-100 text-left hover:border-slate-300 hover:bg-slate-50"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="p-2.5 rounded-xl shrink-0 bg-blue-50 text-blue-600">
                        <ClipboardList size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          Te asignaron el trabajo #{t.numero} - {t.cliente_nombre}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {t.direccion}
                          {t.localidad ? ` - ${t.localidad}` : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }
  if (tab === "Mi recorrido") {
    const ocultos = ["FINALIZADO", "PRESUPUESTADO", "PENDIENTE_PRECIO", "CANCELADO", "LISTO_PARA_COLOCAR", "ANULADO"];
    const propios = trabajos
      .map((t) => ({ t, a: asignacion(t) }))
      .filter(({ t, a }) => a?.usuario_id === usuarioId && !ocultos.includes(t.estado))
      .map(({ t, a }) => ({
        ...t,
        origen: t.fabrica ? "fabrica" : "solicitud",
        id_unico: `${t.fabrica ? "fab" : "sol"}_${t.id}`,
        numero_visible: t.numero || t.id,
        prioridad: a?.prioridad ?? 99,
        fecha_asignada: a?.fecha || t.fecha,
      }))
      .sort((x, y) => x.prioridad - y.prioridad);
    return (
      <MisTrabajosVista
        solicitudes={propios}
        clientes={[]}
        volverHref="/encargado"
        rutaTrabajo="/encargado/trabajo"
      />
    );
  }
  if (tab === "Recorrido de camiones") {
    const propio = false;
    const idTec = tecnico;
    const lista = trabajos
      .map((t) => ({ t, a: asignacion(t) }))
      .filter(
        ({ t, a }) =>
          a &&
          a.usuario_id === idTec &&
          a.fecha === fecha &&
          !["FINALIZADO", "PENDIENTE_PRECIO", "PRESUPUESTADO", "ANULADO"].includes(t.estado),
      )
      .map(({ t, a }) => ({
        ...t,
        _clave: `${t.fabrica ? "fabrica" : "solicitud"}-${t.id}`,
        _esFabrica: t.fabrica,
        prioridad: a?.prioridad ?? null,
      }))
      .sort(
        (x, y) =>
          (x.prioridad ?? 9999) - (y.prioridad ?? 9999) || (x.numero ?? 0) - (y.numero ?? 0),
      );
    return (
      <RecorridoVista
        esTecnico={propio}
        esAdmin={false}
        tecnicos={datos.tecnicos.map((x) => ({ id: x.id, nombre: x.nombre, apellido: "" }))}
        tecnicoSeleccionado={idTec}
        setTecnicoSeleccionado={setTecnico}
        fecha={fecha}
        setFecha={setFecha}
        onBuscar={() => router.refresh()}
        trabajos={lista}
        cargando={false}
        puedeCambiarPrioridad={!propio}
        onCambiarPrioridad={async (t, prioridad, cerrar) => {
          try {
            const r = await operarEncargado("prioridad", {
              id: t.id,
              fabrica: !!t._esFabrica,
              tecnico: idTec,
              fecha,
              prioridad: prioridad ? String(prioridad) : "",
            });
            if (!r.ok) {
              alert(r.mensaje);
              return;
            }
            cerrar();
            router.refresh();
          } catch {
            alert("No se pudo confirmar. Actualizá antes de reintentar.");
          }
        }}
        onQuitar={() => {}}
        onAnular={() => {}}
      />
    );
  }
  if (tab === "Coordinación") {
    return (
      <CoordinacionVista
        solicitudes={trabajos
          .filter((t) => coord.includes(t.estado))
          .map((t) => ({
            ...t,
            es_fabrica: t.fabrica,
            tipo_origen: t.fabrica ? "Instalación" : t.tipo_visita || "Medición / Visita Técnica",
          }))}
        tecnicos={datos.tecnicos}
        cargando={false}
        puedeAsignar
        subtitulo="Asigna fecha y técnico responsable para derivar las órdenes a la hoja de ruta de los camiones."
        onConfirmar={async (d) => {
          try {
            const r = await operarEncargado("asignar", {
              id: d.solicitud.id,
              fabrica: d.solicitud.es_fabrica,
              tecnico: d.tecnicoId,
              fecha: d.fecha,
              franja: d.franja,
              prioridad: d.prioridad ? String(d.prioridad) : "",
            });
            if (!r.ok) {
              alert(r.mensaje);
              return false;
            }
            router.refresh();
            return true;
          } catch {
            alert("No se pudo confirmar. Actualizá antes de reintentar.");
            return false;
          }
        }}
      />
    );
  }
  return (
    <>
      <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
        {tab}
      </h1>
      <p className="mt-1 mb-6 text-xs md:text-sm text-slate-500">
        {descripciones[tab]}
      </p>
      {tab === "Inicio" && (
        <>
          <AvisosAndroid />
          <h2 className="mb-3 text-lg font-bold text-slate-900">
            Novedades y notificaciones
          </h2>
        </>
      )}
      <p role="status" className="mb-4 text-sm text-slate-600">
        {mensaje}
      </p>
      {tab === "Stock de motores" ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {datos.motores.map((m) => (
            <section key={m.id} className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
              <h2 className="font-bold text-lg text-slate-800">{m.nombre}</h2>
              <p
                className={
                  m.cantidad <= m.minimo ? "text-red-700 font-semibold" : ""
                }
              >
                Stock: {m.cantidad} · Mínimo: {m.minimo}
              </p>
              <form
                className="grid gap-3 mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  operaciones.current[m.id] ||= crypto.randomUUID();
                  ejecutar("stock", {
                    operacion: operaciones.current[m.id],
                    motor: m.id,
                    tipo: f.get("tipo"),
                    cantidad: Number(f.get("cantidad")),
                    detalle: f.get("detalle"),
                  });
                }}
              >
                <label className={etiqueta}>
                  Movimiento
                  <Desplegable
                  name="tipo"
                  defaultValue="ENTRADA"
                  className={campo}
                  ariaLabel="Movimiento"
                  opciones={[
                  { value: "ENTRADA", label: "ENTRADA" },
                  { value: "SALIDA", label: "SALIDA" },
                  ]}
                  />
                </label>
                <label className={etiqueta}>
                  Cantidad
                  <input
                    name="cantidad"
                    type="number"
                    min="1"
                    step="1"
                    required
                    className={campo}
                  />
                </label>
                <label className={etiqueta}>
                  Motivo
                  <input
                    name="detalle"
                    maxLength={500}
                    required
                    className={campo}
                  />
                </label>
                <button disabled={ocupado} className={boton}>
                  Registrar movimiento
                </button>
              </form>
              <form
                className="flex gap-3 mt-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  ejecutar("minimo", {
                    motor: m.id,
                    cantidad: Number(
                      new FormData(e.currentTarget).get("minimo"),
                    ),
                  });
                }}
              >
                <label className={etiqueta}>
                  Mínimo
                  <input
                    name="minimo"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={m.minimo}
                    className={campo}
                  />
                </label>
                <button disabled={ocupado} className={boton}>
                  Guardar mínimo
                </button>
              </form>
            </section>
          ))}
        </div>
      ) : (
        <>
          {tab === "Recorrido de camiones" && (
            <div className="grid sm:grid-cols-2 gap-3 mb-5">
              <label className={etiqueta}>
                Técnico
                <Desplegable
                className={campo}
                ariaLabel="Técnico"
                value={tecnico}
                onChange={setTecnico}
                opciones={datos.tecnicos.map((t) => ({ value: String(t.id), label: t.nombre }))}
                />
              </label>
              <label className={etiqueta}>
                Fecha
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={campo}
                />
              </label>
            </div>
          )}
          {tab !== "Inicio" && (
          <label className={`${etiqueta} mb-5`}>
            Buscar cliente, dirección o remito
            <input
              className={campo}
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </label>
          )}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {trabajos
              .filter((t) => {
                const a = asignacion(t);
                if (
                  tab === "Producción" &&
                  (!t.fabrica || !prod.includes(t.estado))
                )
                  return false;
                if (tab === "Coordinación" && !coord.includes(t.estado))
                  return false;
                if (
                  tab === "Recorrido de camiones" &&
                  (!a || a.usuario_id !== tecnico || a.fecha !== fecha)
                )
                  return false;
                if (tab === "Mi recorrido" && a?.usuario_id !== usuarioId)
                  return false;
                if (
                  tab === "Inicio" &&
                  (a?.usuario_id !== usuarioId || a.fecha !== hoy)
                )
                  return false;
                if (
                  tab === "Instalación" &&
                  (!t.fabrica || t.estado !== "LISTO_PARA_COLOCAR")
                )
                  return false;
                return `${t.numero} ${t.cliente_nombre} ${t.direccion}`
                  .toLowerCase()
                  .includes(buscar.toLowerCase());
              })
              .map((t) => {
                const a = asignacion(t);
                return (
                  <section
                    key={`${t.fabrica}-${t.id}`}
                    className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                  >
                    <CabeceraTarjeta
                      numero={t.numero}
                      etiqueta={t.fabrica ? "Instalación" : t.tipo_visita || "Visita"}
                      esFabrica={!!t.fabrica}
                      cliente={t.cliente_nombre}
                      direccion={t.direccion}
                      localidad={t.localidad}
                    />
                    <p className="mt-1 text-xs font-semibold uppercase text-slate-400">
                      {t.estado.replaceAll("_", " ")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.cliente_telefono}
                    </p>
                    <p className="mt-2 text-xs font-medium text-slate-600">
                      {t.fecha ? fechaCivil(t.fecha) : "Sin fecha"} ·{" "}
                      {t.horario_desde?.slice(0, 5) || "--:--"} a{" "}
                      {t.horario_hasta?.slice(0, 5) || "--:--"}
                    </p>
                    {t.observaciones && (
                      <p className="mt-3 line-clamp-3 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                        {t.observaciones}
                      </p>
                    )}
                    {a && (
                      <p className="mt-3 border-t border-slate-100 pt-2 text-xs font-semibold text-slate-800">
                        Asignado:{" "}
                        {datos.tecnicos.find((x) => x.id === a.usuario_id)
                          ?.nombre || "Técnico"}{" "}
                        · Prioridad: {a.prioridad || "Sin prioridad"}
                      </p>
                    )}
                    {tab === "Producción" && (
                      <form
                        className="flex flex-wrap gap-3 mt-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          ejecutar("produccion", {
                            id: t.id,
                            fabrica: true,
                            estado: new FormData(e.currentTarget).get("estado"),
                          });
                        }}
                      >
                        <Desplegable
                        ariaLabel="Nuevo estado"
                        name="estado"
                        defaultValue={t.estado}
                        className={campo}
                        opciones={[
                        "ENVIADO_A_CORTAR",
                        "EN_CORTE",
                        "EN_FABRICACION",
                        "FALTANTES",
                        "LISTO_PARA_COLOCAR",
                        ].map((x) => ({ value: x, label: x }))}
                        />
                        <button disabled={ocupado} className={boton}>
                          Cambiar estado
                        </button>
                      </form>
                    )}
                    {tab === "Recorrido de camiones" && a && (
                      <form
                        className="flex gap-3 mt-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          ejecutar("prioridad", {
                            id: t.id,
                            fabrica: t.fabrica,
                            tecnico: a.usuario_id,
                            fecha: a.fecha,
                            prioridad: new FormData(e.currentTarget).get(
                              "prioridad",
                            ),
                          });
                        }}
                      >
                        <Desplegable
                        name="prioridad"
                        defaultValue={String(a.prioridad || "")}
                        className={campo}
                        ariaLabel="Prioridad"
                        placeholder="Sin prioridad"
                        opciones={[
                        { value: "", label: "Sin prioridad" },
                        ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
                        ]}
                        />
                        <button disabled={ocupado} className={boton}>
                          Guardar prioridad
                        </button>
                      </form>
                    )}
                    {tab === "Instalación" && (
                      <div className="mt-4">
                        <VerDetallesInstalacion observaciones={t.observaciones} />
                      </div>
                    )}
                    {a?.usuario_id === usuarioId && (
                      <Link
                        className="inline-block mt-4 font-semibold text-blue-700"
                        href={`/encargado/trabajo/${t.id}?origen=${t.fabrica ? "fabrica" : "solicitud"}`}
                      >
                        Completar mi remito →
                      </Link>
                    )}
                  </section>
                );
              })}
          </div>
          {tab === "Inicio" &&
            !trabajos.some((t) => {
              const a = asignacion(t);
              return a?.usuario_id === usuarioId && a.fecha === hoy;
            }) && (
            <p className="mt-5 text-sm text-slate-500">
              {"No hay novedades para hoy."}
            </p>
          )}
          <p className="mt-5 text-sm text-slate-500">
            Sólo se muestran trabajos operativos activos. Los remitos se
            completan únicamente cuando están asignados a tu usuario.
          </p>
        </>
      )}
    </>
  );
}
