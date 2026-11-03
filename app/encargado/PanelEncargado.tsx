"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { operarEncargado } from "./actions";
import { fechaLinda as fechaCivil } from "@/lib/fechasFicha";
import Desplegable from "@/components/Desplegable";
import AvisosAndroid from "@/components/AvisosAndroid";
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
  "Coordinación": "Asigná los trabajos pendientes a un técnico.",
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
        <div className="grid gap-4 lg:grid-cols-2">
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
          <div className="grid gap-4 lg:grid-cols-2">
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
                    className="rounded-xl bg-white p-5 shadow-sm border border-slate-200"
                  >
                    <p className="text-xs font-semibold uppercase text-slate-400">
                      #{t.numero} · {t.estado.replaceAll("_", " ")}
                    </p>
                    <h2 className="font-bold text-lg text-slate-800">{t.cliente_nombre}</h2>
                    <p>
                      {t.direccion}
                      {t.localidad ? ` · ${t.localidad}` : ""}
                    </p>
                    <p>{t.cliente_telefono}</p>
                    <p className="mt-2 text-sm">
                      {t.tipo_visita} ·{" "}
                      {t.fecha ? fechaCivil(t.fecha) : "Sin fecha"} ·{" "}
                      {t.horario_desde?.slice(0, 5) || "--:--"} a{" "}
                      {t.horario_hasta?.slice(0, 5) || "--:--"}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">
                      {t.observaciones}
                    </p>
                    {a && (
                      <p className="mt-3 font-medium">
                        Asignado:{" "}
                        {datos.tecnicos.find((x) => x.id === a.usuario_id)
                          ?.nombre || "Técnico"}{" "}
                        · Prioridad: {a.prioridad || "Sin prioridad"}
                      </p>
                    )}
                    {tab === "Coordinación" && (
                      <form
                        className="grid gap-3 mt-4"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          ejecutar("asignar", {
                            id: t.id,
                            fabrica: t.fabrica,
                            tecnico: f.get("tecnico"),
                            fecha: f.get("fecha"),
                            franja: f.get("franja"),
                            prioridad: f.get("prioridad"),
                          });
                        }}
                      >
                        <label className={etiqueta}>
                          Técnico
                          <Desplegable
                          name="tecnico"
                          required
                          defaultValue={a?.usuario_id || ""}
                          className={campo}
                          ariaLabel="Técnico"
                          placeholder="Seleccionar"
                          opciones={datos.tecnicos.map((x) => ({ value: String(x.id), label: x.nombre }))}
                          />
                        </label>
                        <label className={etiqueta}>
                          Fecha pactada
                          <input
                            key={`fecha-${t.id}-${hoy}`}
                            name="fecha"
                            type="date"
                            required
                            defaultValue={a?.fecha || hoy}
                            className={campo}
                          />
                        </label>
                        {!t.horario_desde && !t.horario_hasta && (
                          <label className={etiqueta}>
                            Horario
                            <Desplegable
                            name="franja"
                            defaultValue="DIA_COMPLETO"
                            className={campo}
                            ariaLabel="Horario"
                            opciones={[
                            { value: "DIA_COMPLETO", label: "Día completo" },
                            { value: "MANANA", label: "Mañana08:30–12:30" },
                            { value: "TARDE", label: "Tarde13–17" },
                            ]}
                            />
                          </label>
                        )}
                        <label className={etiqueta}>
                          Prioridad
                          <Desplegable
                          name="prioridad"
                          defaultValue={String(a?.prioridad || "")}
                          className={campo}
                          ariaLabel="Prioridad"
                          placeholder="Sin prioridad"
                          opciones={[
                          { value: "", label: "Sin prioridad" },
                          ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) })),
                          ]}
                          />
                        </label>
                        <button disabled={ocupado} className={boton}>
                          {a ? "Actualizar asignación" : "Asignar trabajo"}
                        </button>
                      </form>
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
