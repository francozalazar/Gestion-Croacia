"use client";

import { useState } from "react";
import { colorCoordinacion, esUrgencia } from "@/lib/coordinacion";
import { Search, X, User, ShieldAlert } from "lucide-react";
import Desplegable from "@/components/Desplegable";
import CabeceraTarjeta from "@/components/TarjetaSolicitud";

// =========================================================
// FRANJAS HORARIAS (misma convención que solicitudes)
// =========================================================

export function obtenerFranjaDesdeHorario(
  desde?: string | null,
  hasta?: string | null
): "MANANA" | "TARDE" | "DIA_COMPLETO" | "PERSONALIZADO" | null {
  if (!desde && !hasta) return null; // sin horario pactado
  const hDesde = (desde || "").slice(0, 5);
  const hHasta = (hasta || "").slice(0, 5);
  if (
    ["08:00", "08:30", "09:00"].includes(hDesde) &&
    ["12:00", "12:30", "13:00"].includes(hHasta)
  ) {
    return "MANANA";
  }
  if (
    ["13:00", "13:30", "14:00"].includes(hDesde) &&
    ["17:00", "17:30", "18:00"].includes(hHasta)
  ) {
    return "TARDE";
  }
  if (
    ["08:00", "08:30", "09:00"].includes(hDesde) &&
    ["17:00", "17:30", "18:00"].includes(hHasta)
  ) {
    return "DIA_COMPLETO";
  }
  return "PERSONALIZADO";
}

function textoFranjaPactada(
  desde?: string | null,
  hasta?: string | null
): string {
  const f = obtenerFranjaDesdeHorario(desde, hasta);
  if (f === "MANANA") return "🌅 Mañana (08:30 - 12:30 hs)";
  if (f === "TARDE") return "☀️ Tarde (13:00 - 17:00 hs)";
  if (f === "DIA_COMPLETO") return "📅 Día completo (08:30 - 17:00 hs)";
  return `🕐 ${(desde || "").slice(0, 5) || "--:--"} a ${(hasta || "").slice(0, 5) || "--:--"} hs`;
}

export function hoyArgentina(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export type ConfirmarCoordinacion = {
  solicitud: any;
  tecnicoId: string;
  fecha: string;
  prioridad: number | null;
  franja: string;
  hDesde: string;
  hHasta: string;
};

// Pantalla de Coordinación compartida: la usan Oficina/Admin y Encargado.
// Los datos y la acción de asignar los pone quien la renderiza.
export default function CoordinacionVista({
  solicitudes,
  tecnicos,
  cargando,
  puedeAsignar,
  subtitulo,
  onConfirmar,
}: {
  solicitudes: any[];
  tecnicos: any[];
  cargando: boolean;
  puedeAsignar: boolean;
  subtitulo: string;
  onConfirmar: (d: ConfirmarCoordinacion) => Promise<boolean>;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [solicitudModal, setSolicitudModal] = useState<any | null>(null);
  const [verDetallesModal, setVerDetallesModal] = useState<any | null>(null);
  const [fechaPactada, setFechaPactada] = useState("");
  const [franjaSeleccionada, setFranjaSeleccionada] = useState("DIA_COMPLETO");
  const [tecnicoId, setTecnicoId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [prioridad, setPrioridad] = useState<string>("");

  // =========================================================
  // BUSCADOR
  // =========================================================

  const solicitudesFiltradas = solicitudes.filter((s) => {
    const termino = busqueda.toLowerCase().trim();

    return (
      (s.cliente_nombre &&
        s.cliente_nombre
          .toLowerCase()
          .includes(termino)) ||

      (s.direccion &&
        s.direccion
          .toLowerCase()
          .includes(termino)) ||

      (s.localidad &&
        s.localidad
          .toLowerCase()
          .includes(termino)) ||

      (s.usuario_creador &&
        s.usuario_creador
          .toLowerCase()
          .includes(termino))
    );
  });

  async function handleConfirmarCoordinacion() {
    if (!solicitudModal || !fechaPactada || !tecnicoId) return;
    const prioridadNumerica = prioridad ? Number(prioridad) : null;
    if (
      prioridadNumerica !== null &&
      (!Number.isInteger(prioridadNumerica) ||
        prioridadNumerica < 1 ||
        prioridadNumerica > 5)
    ) {
      alert("La prioridad debe estar entre 1 y 5.");
      return;
    }
    // Si la solicitud ya trae un horario pactado, se respeta tal cual.
    const franjaPactada = obtenerFranjaDesdeHorario(
      solicitudModal.horario_desde,
      solicitudModal.horario_hasta
    );
    let hDesde = "08:30";
    let hHasta = "17:00";
    if (franjaPactada) {
      hDesde = solicitudModal.horario_desde;
      hHasta = solicitudModal.horario_hasta;
    } else if (franjaSeleccionada === "MANANA") {
      hDesde = "08:30";
      hHasta = "12:30";
    } else if (franjaSeleccionada === "TARDE") {
      hDesde = "13:00";
      hHasta = "17:00";
    }
    setGuardando(true);
    const ok = await onConfirmar({
      solicitud: solicitudModal,
      tecnicoId,
      fecha: fechaPactada,
      prioridad: prioridadNumerica,
      franja: franjaSeleccionada,
      hDesde,
      hHasta,
    });
    setGuardando(false);
    if (ok) cerrarModal();
  }

  // =========================================================
  // ABRIR MODAL
  // =========================================================

  function abrirModal(s: any) {
    setVerDetallesModal(null);
    setSolicitudModal(s);

    setFechaPactada(
      hoyArgentina()
    );

    setFranjaSeleccionada(
      obtenerFranjaDesdeHorario(
        s.horario_desde,
        s.horario_hasta
      ) === null
        ? "DIA_COMPLETO"
        : (obtenerFranjaDesdeHorario(
            s.horario_desde,
            s.horario_hasta
          ) as string)
    );
    setTecnicoId("");
  }

  // =========================================================
  // CERRAR MODAL
  // =========================================================

  function cerrarModal() {
    setSolicitudModal(null);
  }

  return (
    <>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Coordinación de Trabajos
        </h1>

        <p className="mb-6 text-xs text-slate-500">{subtitulo}</p>

        {/* =====================================================
            BUSCADOR
        ====================================================== */}

        <div className="relative mb-8 max-w-4xl">

          <input
            type="text"
            placeholder="Buscar por cliente, dirección o por quién cargó el trabajo..."
            value={busqueda}
            onChange={(e) =>
              setBusqueda(e.target.value)
            }
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm outline-none shadow-sm focus:border-blue-500"
          />

          <Search
            className="absolute right-3 top-3.5 text-slate-400"
            size={18}
          />

        </div>

        {/* =====================================================
            LISTA
        ====================================================== */}

        {cargando ? (

          <p className="text-sm text-slate-400">
            Cargando coordinaciones...
          </p>

        ) : solicitudesFiltradas.length === 0 ? (

          <div className="rounded-xl bg-white p-12 text-center shadow-sm">

            <p className="text-sm text-slate-500">
              No hay coordinaciones pendientes.
            </p>

          </div>

        ) : (

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">

            {solicitudesFiltradas.map((s) => (

              <div
                key={`${s.es_fabrica ? "fabrica" : "solicitud"}-${s.id}`}
                onClick={() => abrirModal(s)}
                className={`cursor-pointer rounded-xl border p-6 shadow-sm transition hover:shadow-md ${colorCoordinacion(s)}`}
              >

                <CabeceraTarjeta
                  numero={s.numero || s.numero_remito || s.id}
                  etiqueta={s.tipo_origen}
                  esFabrica={s.es_fabrica}
                  urgente={esUrgencia(s)}
                  sinAntiguedad={!s.coordinacion_desde}
                  cliente={s.cliente_nombre}
                  direccion={s.direccion}
                  localidad={s.localidad}
                />

                {/* =================================================
                    QUIÉN CARGÓ
                ================================================== */}

                {s.usuario_creador !== undefined && (
                <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-500">

                  <User
                    size={13}
                    className="text-slate-400"
                  />

                  <span>
                    Cargado por:
                  </span>

                  <span className="font-semibold text-slate-800">
                    {s.usuario_creador ||
                      "Sin usuario"}
                  </span>

                </div>
                )}

              </div>

            ))}

          </div>

        )}

        {/* =====================================================
            MODAL
        ====================================================== */}

        {solicitudModal && (

          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">

            <div className="relative w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl">

              {/* CERRAR */}

              <button
                onClick={cerrarModal}
                className="absolute right-6 top-6 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              {/* USUARIO QUE CARGÓ */}

              <div className="mb-4 flex gap-2">

                <span className="inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">

                  Cargado por:{" "}

                  {solicitudModal.usuario_creador ||
                    "Sin usuario"}

                </span>

              </div>

              {/* CLIENTE */}

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                {solicitudModal.cliente_nombre ||
                  "Cliente sin nombre"}
              </h1>

              {/* DIRECCIÓN */}

              <p className="mt-1 text-lg font-medium text-slate-700">

                {solicitudModal.direccion}{" "}

                {solicitudModal.localidad
                  ? `- ${solicitudModal.localidad}`
                  : ""}

              </p>

              {/* DETALLE */}

              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs text-slate-600">

                <p>

                  <strong>
                    Detalle:
                  </strong>{" "}

                  {solicitudModal.observaciones ||
                    "Sin especificaciones"}

                </p>

              </div>

              {/* =================================================
                  SOLO ADMIN
              ================================================== */}

              {puedeAsignar ? (

                <div className="mt-6 space-y-4 border-t border-slate-100 pt-4">

                  <div className="grid grid-cols-2 gap-4">

                    {/* FECHA */}

                    <div>

                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                        Fecha pactada
                      </label>

                      <input
                        type="date"
                        value={fechaPactada}
                        onChange={(e) =>
                          setFechaPactada(
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-sm outline-none focus:border-blue-500"
                      />

                    </div>

                    {/* TÉCNICO */}

                    <div>

                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                        Técnico / Chofer
                      </label>

                      <Desplegable
                      value={tecnicoId}
                      onChange={setTecnicoId}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500"
                      ariaLabel="Técnico / Chofer"
                      placeholder="Seleccionar técnico..."
                      opciones={[
                      { value: "", label: "Seleccionar técnico..." },
                      ...tecnicos.map((t) => ({ value: String(t.id), label: `👷 ${t.nombre} ${t.apellido || ""}` })),
                      ]}
                      />

                    </div>

                  </div>

                  {/* FRANJA */}

                  {obtenerFranjaDesdeHorario(
                    solicitudModal.horario_desde,
                    solicitudModal.horario_hasta
                  ) !== null ? (

                    <div>

                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                        Horario pactado
                      </label>

                      <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm text-slate-700">
                        {textoFranjaPactada(
                          solicitudModal.horario_desde,
                          solicitudModal.horario_hasta
                        )}
                        <span className="ml-2 text-xs text-slate-400">
                          (cargado en la solicitud, no se puede cambiar)
                        </span>
                      </div>

                    </div>

                  ) : (

                    <div>

                      <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                        Franja Horaria
                      </label>

                      <Desplegable
                      value={franjaSeleccionada}
                      onChange={setFranjaSeleccionada}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500"
                      ariaLabel="Franja Horaria"
                      opciones={[
                      { value: "MANANA", label: "🌅 Mañana (08:30 - 12:30 hs)" },
                      { value: "TARDE", label: "☀️ Tarde (13:00 - 17:00 hs)" },
                      { value: "DIA_COMPLETO", label: "📅 Día completo (08:30 - 17:00 hs)" },
                      ]}
                      />

                    </div>

                  )}

                  {/* PRIORIDAD */}

                  <div>

                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                      Prioridad del recorrido
                    </label>

                    <Desplegable
                    value={prioridad}
                    onChange={setPrioridad}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500"
                    ariaLabel="Prioridad del recorrido"
                    placeholder="Sin prioridad"
                    opciones={[
                    { value: "", label: "Sin prioridad" },
                    ...[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `Prioridad ${n}` })),
                    ]}
                    />

                  </div>

                </div>

              ) : (

                <div className="mt-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs font-medium text-amber-800">

                  <ShieldAlert size={16} />

                  <span>
                    Pendiente de asignación por Admin.
                  </span>

                </div>

              )}

              {/* =================================================
                  BOTONES
              ================================================== */}

              <div className="mt-8 flex items-center justify-between">

                <button
                  onClick={cerrarModal}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cerrar
                </button>

                {puedeAsignar && (

                  <button
                    onClick={
                      handleConfirmarCoordinacion
                    }
                    disabled={
                      guardando ||
                      !tecnicoId ||
                      !fechaPactada
                    }
                    className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
                  >

                    {guardando
                      ? "Guardando..."
                      : "Confirmar Coordinación"}

                  </button>

                )}

              </div>

            </div>

          </div>

        )}

    </>
  );
}
