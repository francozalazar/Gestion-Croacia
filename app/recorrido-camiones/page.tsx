"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import { Search, X, Truck, Calendar } from "lucide-react";

export default function RecorridoCamionesPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [tecnicoSeleccionado, setTecnicoSeleccionado] = useState<string>("");
  const [fecha, setFecha] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [trabajos, setTrabajos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [trabajoModal, setTrabajoModal] = useState<any | null>(null);
  const [nuevaPrioridad, setNuevaPrioridad] = useState<string>("");

  useEffect(() => {
    cargarInicial();
  }, []);

  async function cargarInicial() {
    // 1. Obtener datos del usuario logueado
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, rol")
      .eq("id", user.id)
      .single();

    setPerfil(profile);

    // 2. Cargar TODOS los técnicos / camiones del sistema
    const { data } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, rol")
      .eq("rol", "TECNICO")
      .eq("activo", true)
      .order("nombre");

    const listaTecs = data || [];
    setTecnicos(listaTecs);

    // Seleccionar automáticamente el primer camión si existe
    if (listaTecs.length > 0) {
      setTecnicoSeleccionado(listaTecs[0].id);
      ejecutarBusqueda(listaTecs[0].id, fecha);
    }
  }

  function obtenerTextoFranja(desde?: string | null, hasta?: string | null) {
    if (!desde && !hasta) return "Día completo (8:30 - 17:00 hs)";
    const hDesde = desde?.slice(0, 5) || "";
    const hHasta = hasta?.slice(0, 5) || "";

    if (["08:00", "08:30", "09:00"].includes(hDesde) && ["12:00", "12:30", "13:00"].includes(hHasta)) {
      return "Mañana (8:30 - 12:30 hs)";
    }
    if (["13:00", "13:30", "14:00"].includes(hDesde) && ["17:00", "17:30", "18:00"].includes(hHasta)) {
      return "Tarde (13:00 - 17:00 hs)";
    }
    return `Horario: ${desde || "8:30"} a ${hasta || "17:00"} hs`;
  }

  async function buscarRecorrido() {
    if (!tecnicoSeleccionado) return;
    ejecutarBusqueda(tecnicoSeleccionado, fecha);
  }

  async function ejecutarBusqueda(tecId: string, fechaFiltro: string) {
    setCargando(true);

    const { data: asignaciones, error: errorAsignaciones } = await supabase
      .from("asignaciones")
      .select("*")
      .eq("usuario_id", tecId)
      .eq("fecha", fechaFiltro);

    if (errorAsignaciones) {
      console.error("Error obteniendo asignaciones:", errorAsignaciones);
      setTrabajos([]);
      setCargando(false);
      return;
    }

    const asignacionesLista = asignaciones || [];

    const idsSolicitudes = asignacionesLista
      .map((a) => a.solicitud_id)
      .filter(Boolean);

    const idsFabrica = asignacionesLista
      .map((a) => a.solicitud_fabrica_id)
      .filter(Boolean);

    const [{ data: solicitudesNormales }, { data: solicitudesFabrica }] =
      await Promise.all([
        idsSolicitudes.length > 0
          ? supabase
              .from("solicitudes")
              .select("*")
              .in("id", idsSolicitudes)
          : Promise.resolve({ data: [] }),

        idsFabrica.length > 0
          ? supabase
              .from("solicitudes_fabrica")
              .select("*")
              .in("id", idsFabrica)
          : Promise.resolve({ data: [] }),
      ]);

    const trabajosNormales = (solicitudesNormales || []).map((solicitud) => {
      const asignacion = asignacionesLista.find(
        (a) => a.solicitud_id === solicitud.id
      );

      return {
        ...solicitud,
        _clave: `solicitud-${solicitud.id}`,
        _esFabrica: false,
        prioridad: asignacion?.prioridad ?? null,
      };
    });

    const trabajosFabrica = (solicitudesFabrica || []).map((solicitud) => {
      const asignacion = asignacionesLista.find(
        (a) =>
          String(a.solicitud_fabrica_id) === String(solicitud.id)
      );

      return {
        ...solicitud,
        _clave: `fabrica-${solicitud.id}`,
        _esFabrica: true,
        numero: solicitud.numero_remito || solicitud.numero,
        prioridad: asignacion?.prioridad ?? null,
      };
    });

    const trabajosActivos = [
      ...trabajosNormales,
      ...trabajosFabrica,
    ].filter((trabajo) => {
      const estado = trabajo.estado;

      return !estadosNoVisiblesEnRecorrido.includes(estado);
    });

    // Ordenar por prioridad (1, 2, 3...); los trabajos sin prioridad van al final
    trabajosActivos.sort((a, b) => {
      const pa = a.prioridad ?? 9999;
      const pb = b.prioridad ?? 9999;
      if (pa !== pb) return pa - pb;
      return (a.numero ?? 0) - (b.numero ?? 0);
    });

    setTrabajos(trabajosActivos);
    setCargando(false);
  }

  async function cambiarPrioridad() {
    if (!trabajoModal) return;

    const prioridadNumerica = nuevaPrioridad
      ? Number(nuevaPrioridad)
      : null;

    const columnaRelacion = trabajoModal._esFabrica
      ? "solicitud_fabrica_id"
      : "solicitud_id";

    const { error } = await supabase
      .from("asignaciones")
      .update({ prioridad: prioridadNumerica })
      .eq(columnaRelacion, trabajoModal.id)
      .eq("usuario_id", tecnicoSeleccionado)
      .eq("fecha", fecha);

    if (error) {
      alert(
        error.code === "23505"
          ? `Ya existe otro trabajo con prioridad ${prioridadNumerica} ese día.`
          : error.message
      );
      return;
    }

    setTrabajoModal(null);
    await ejecutarBusqueda(tecnicoSeleccionado, fecha);
  }

  // ACCIÓN 1: Quita la asignación del técnico y lo devuelve a COORDINACIÓN
  async function removerTecnicoYFecha() {
    if (!trabajoModal) return;

    const columnaRelacion = trabajoModal._esFabrica
      ? "solicitud_fabrica_id"
      : "solicitud_id";

    const tablaRelacion = trabajoModal._esFabrica
      ? "solicitudes_fabrica"
      : "solicitudes";

    const { error: errorAsignacion } = await supabase
      .from("asignaciones")
      .delete()
      .eq(columnaRelacion, trabajoModal.id)
      .eq("usuario_id", tecnicoSeleccionado)
      .eq("fecha", fecha);

    if (errorAsignacion) {
      alert("Error quitando asignación: " + errorAsignacion.message);
      return;
    }

    // La fecha y el técnico pactados viven en la asignación (ya borrada arriba).
    // solicitudes.fecha es la fecha del trabajo y no admite null: se conserva.
    const datosReset = { estado: "PENDIENTE_COORDINACION" };

    const { error: errorSolicitud } = await supabase
      .from(tablaRelacion)
      .update(datosReset)
      .eq("id", trabajoModal.id);

    if (errorSolicitud) {
      alert("Error actualizando trabajo: " + errorSolicitud.message);
      return;
    }

    // Si es un trabajo de fábrica, sincronizamos la solicitud principal
    // para que oficina vea el estado real.
    if (trabajoModal._esFabrica) {
      await supabase
        .from("solicitudes")
        .update(datosReset)
        .eq("solicitud_fabrica_id", trabajoModal.id);
    }

    setTrabajoModal(null);
    await ejecutarBusqueda(tecnicoSeleccionado, fecha);
  }

  // ACCIÓN 2: Anula completamente la visita
  async function anularVisita() {
    if (!trabajoModal) return;

    if (!confirm("¿Estás seguro de anular esta visita? El remito quedará cancelado.")) return;

    const columnaRelacion = trabajoModal._esFabrica
      ? "solicitud_fabrica_id"
      : "solicitud_id";

    const tablaRelacion = trabajoModal._esFabrica
      ? "solicitudes_fabrica"
      : "solicitudes";

    const { error: errorAsignacion } = await supabase
      .from("asignaciones")
      .delete()
      .eq(columnaRelacion, trabajoModal.id)
      .eq("usuario_id", tecnicoSeleccionado)
      .eq("fecha", fecha);

    if (errorAsignacion) {
      alert("Error anulando asignación: " + errorAsignacion.message);
      return;
    }

    const { error: errorSolicitud } = await supabase
      .from(tablaRelacion)
      .update({ estado: "ANULADO" })
      .eq("id", trabajoModal.id);

    if (errorSolicitud) {
      alert("Error anulando trabajo: " + errorSolicitud.message);
      return;
    }

    setTrabajoModal(null);
    await ejecutarBusqueda(tecnicoSeleccionado, fecha);
  }

  const estadosNoVisiblesEnRecorrido = [
    "FINALIZADO",
    "PENDIENTE_PRECIO",
    "PRESUPUESTADO",
    "ANULADO",
  ];

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 pt-20 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Recorrido de camiones
        </h1>

        {/* FILTROS DE BÚSQUEDA */}
        <div className="mx-auto max-w-2xl bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between mb-10">
          <div className="w-full">
            <label className="text-xs font-semibold text-slate-400 block mb-1 uppercase flex items-center gap-1.5">
              <Truck size={14} /> Seleccionar Camión / Técnico
            </label>
            <select
              value={tecnicoSeleccionado}
              onChange={(e) => setTecnicoSeleccionado(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-medium outline-none focus:border-blue-500 bg-white"
            >
              <option value="">Seleccionar camión...</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  🚛 {t.nombre} {t.apellido || ""}
                </option>
              ))}
            </select>
          </div>

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
            onClick={buscarRecorrido}
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
              {tecnicoSeleccionado
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

              {/* SELECTOR DE PRIORIDADES DEL 1 AL 5 */}
              <div className="mt-6">
                <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">
                  Cambiar prioridad
                </label>
                <select
                  value={nuevaPrioridad}
                  onChange={(e) => setNuevaPrioridad(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-slate-700 text-sm outline-none bg-white"
                >
                  <option value="">Seleccionar prioridad...</option>
                  <option value="1">Prioridad: 1</option>
                  <option value="2">Prioridad: 2</option>
                  <option value="3">Prioridad: 3</option>
                  <option value="4">Prioridad: 4</option>
                  <option value="5">Prioridad: 5</option>
                  <option value="">Sin prioridad</option>
                </select>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="mt-8 flex flex-wrap justify-end gap-3">
                <button
                  onClick={removerTecnicoYFecha}
                  className="bg-amber-100 text-amber-900 border border-amber-200 px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-200 transition"
                >
                  Remover técnico y fecha
                </button>
                <button
                  onClick={anularVisita}
                  className="bg-rose-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-rose-600 transition"
                >
                  Anular visita
                </button>
                <button
                  onClick={cambiarPrioridad}
                  className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-blue-700 transition"
                >
                  Cambiar prioridad
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
