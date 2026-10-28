"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { operarEncargado } from "./actions";
import { fechaLinda as fechaCivil } from "@/lib/fechasFicha";
import Desplegable from "@/components/Desplegable";
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
const campo = "w-full rounded-lg border border-slate-300 bg-white p-2.5";
const boton =
  "rounded-lg bg-slate-900 px-4 py-2.5 text-white disabled:opacity-50";
const coord = [
  "PENDIENTE_COORDINACION",
  "COORDINACION",
  "ENVIADO_COORDINACION",
  "LISTO_PARA_COLOCAR",
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
    seccion &&
      [
        "Coordinación",
        "Recorrido de camiones",
        "Producción",
        "Stock de motores",
        "Mis trabajos",
      ].includes(seccion)
      ? seccion
      : "Coordinación",
  );
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [buscar, setBuscar] = useState("");
  const [tecnico, setTecnico] = useState(datos.tecnicos[0]?.id || "");
  const [fecha, setFecha] = useState(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  );
  useEffect(() => {
    if (
      seccion &&
      [
        "Coordinación",
        "Recorrido de camiones",
        "Producción",
        "Stock de motores",
        "Mis trabajos",
      ].includes(seccion)
    )
      setTab(seccion);
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
      <nav className="flex flex-wrap gap-2 mb-5" aria-label="Operaciones">
        {[
          "Coordinación",
          "Recorrido de camiones",
          "Producción",
          "Stock de motores",
          "Mis trabajos",
        ].map((x) => (
          <button
            key={x}
            onClick={() => {
              setTab(x);
              setMensaje("");
            }}
            className={
              tab === x ? boton : "rounded-lg border bg-white px-4 py-2.5"
            }
          >
            {x}
          </button>
        ))}
      </nav>
      <p role="status" className="mb-4">
        {mensaje}
      </p>
      {tab === "Stock de motores" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {datos.motores.map((m) => (
            <section key={m.id} className="rounded-xl border bg-white p-5">
              <h2 className="font-bold">{m.nombre}</h2>
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
                <label>
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
                <label>
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
                <label>
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
                <label>
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
              <label>
                Técnico
                <Desplegable
                className={campo}
                ariaLabel="Técnico"
                value={tecnico}
                onChange={setTecnico}
                opciones={datos.tecnicos.map((t) => ({ value: String(t.id), label: t.nombre }))}
                />
              </label>
              <label>
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
          <label className="block mb-5">
            Buscar cliente, dirección o remito
            <input
              className={campo}
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
            />
          </label>
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
                if (tab === "Mis trabajos" && a?.usuario_id !== usuarioId)
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
                    className="rounded-xl border bg-white p-5"
                  >
                    <p className="text-sm text-slate-600">
                      #{t.numero} · {t.estado.replaceAll("_", " ")}
                    </p>
                    <h2 className="font-bold text-lg">{t.cliente_nombre}</h2>
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
                        <label>
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
                        <label>
                          Fecha pactada
                          <input
                            name="fecha"
                            type="date"
                            required
                            defaultValue={a?.fecha || t.fecha || ""}
                            className={campo}
                          />
                        </label>
                        {!t.horario_desde && !t.horario_hasta && (
                          <label>
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
                        <label>
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
          <p className="mt-5 text-sm text-slate-500">
            Sólo se muestran trabajos operativos activos. Los remitos se
            completan únicamente cuando están asignados a tu usuario.
          </p>
        </>
      )}
    </>
  );
}
