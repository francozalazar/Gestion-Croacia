"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import {
  Search,
  X,
  MapPin,
  Phone,
  Calendar,
  Clock,
  FileText,
  User,
  ShieldAlert,
} from "lucide-react";

export default function CoordinacionPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);

  // Modales
  const [solicitudModal, setSolicitudModal] = useState<any | null>(null);
  const [verDetallesModal, setVerDetallesModal] = useState<any | null>(null);

  // Campos de formulario para asignación
  const [fechaPactada, setFechaPactada] = useState("");
  const [franjaSeleccionada, setFranjaSeleccionada] =
    useState("DIA_COMPLETO");
  const [tecnicoId, setTecnicoId] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [prioridad, setPrioridad] = useState<string>("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/";
      return;
    }

    // =========================================================
    // 1. OBTENER PERFIL DEL USUARIO ACTUAL
    // =========================================================

    const { data: profile, error: errorProfile } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, rol")
      .eq("id", user.id)
      .single();

    if (errorProfile) {
      console.error("Error obteniendo perfil:", errorProfile);
    }

    setPerfil(profile);

    // =========================================================
    // 2. CARGAR TÉCNICOS
    // =========================================================

    const { data: tecs, error: errorTecnicos } = await supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .eq("rol", "TECNICO")
      .eq("activo", true)
      .order("nombre");

    if (errorTecnicos) {
      console.error("Error obteniendo técnicos:", errorTecnicos);
    }

    setTecnicos(tecs || []);

    // =========================================================
    // 3. SOLICITUDES NORMALES
    // =========================================================

   const { data: solBase, error: errorSolBase } = await supabase
  .from("solicitudes")
  .select(`
    *,
    creador:profiles!creado_por(
      id,
      nombre,
      apellido
    )
  `)
  .in("estado", [
    "PENDIENTE",
    "PENDIENTE_COORDINACION",
    "COORDINACION",
  ]);

    if (errorSolBase) {
      console.error("Error obteniendo solicitudes:", errorSolBase);
    }

    // =========================================================
    // 4. SOLICITUDES DE FÁBRICA
    // =========================================================

    const { data: solFabrica, error: errorSolFabrica } = await supabase
      .from("solicitudes_fabrica")
      .select(`
        *,
        creador:profiles!creado_por(
          id,
          nombre,
          apellido
        )
      `)
      .in("estado", [
        "PENDIENTE",
        "PENDIENTE_COORDINACION",
        "COORDINACION",
      ]);

    if (errorSolFabrica) {
      console.error(
        "Error obteniendo solicitudes de fábrica:",
        errorSolFabrica
      );
    }

    // =========================================================
    // 5. MAPEAR SOLICITUDES DE FÁBRICA
    // =========================================================

    const mapeadasFab = (solFabrica || []).map((item) => ({
      ...item,
      es_fabrica: true,
      solicitud_fabrica_id: item.id,
    }));

    // =========================================================
    // 6. EVITAR DUPLICADOS ENTRE FÁBRICA Y SOLICITUDES NORMALES
    // =========================================================

    const idsFab = new Set(
      mapeadasFab.map((f) => String(f.numero_remito))
    );

    const baseFiltradas = (solBase || [])
      .filter(
        (s) =>
          !idsFab.has(
            String(s.numero || s.numero_remito)
          )
      )
      .map((s) => ({
        ...s,
        es_fabrica: false,
        tipo_origen:
          s.tipo_visita || "Medición / Visita Técnica",
        usuario_creador: s.creador
          ? `${s.creador.nombre} ${s.creador.apellido || ""}`.trim()
          : "Sin usuario",
      }));

    // =========================================================
    // 7. UNIR TODO
    // =========================================================

    setSolicitudes([
      ...mapeadasFab,
      ...baseFiltradas,
    ]);

    setCargando(false);
  }

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

  // =========================================================
  // CONFIRMAR COORDINACIÓN (USANDO UPSERT Y FECHA)
  // =========================================================

  async function handleConfirmarCoordinacion() {
    if (!solicitudModal || !fechaPactada || !tecnicoId) return;

    setGuardando(true);

    const prioridadNumerica = prioridad
      ? Number(prioridad)
      : null;

    if (
      prioridadNumerica !== null &&
      (!Number.isInteger(prioridadNumerica) ||
        prioridadNumerica < 1 ||
        prioridadNumerica > 5)
    ) {
      alert("La prioridad debe estar entre 1 y 5.");
      setGuardando(false);
      return;
    }

    let hDesde = "08:30";
    let hHasta = "17:00";

    if (franjaSeleccionada === "MANANA") {
      hDesde = "08:30";
      hHasta = "12:30";
    } else if (franjaSeleccionada === "TARDE") {
      hDesde = "13:00";
      hHasta = "17:00";
    }

    // =========================================================
    // 1. GUARDAR / ACTUALIZAR ASIGNACIÓN CON UPSERT
    // =========================================================

    let solicitudIdAsignacion = solicitudModal.id;

    let errorAsignacion: any = null;

    if (solicitudModal.es_fabrica) {
      const { data: asignacionExistente } = await supabase
        .from("asignaciones")
        .select("id")
        .eq("solicitud_fabrica_id", solicitudModal.id)
        .maybeSingle();

      if (asignacionExistente) {
        const resultado = await supabase
          .from("asignaciones")
          .update({
            usuario_id: tecnicoId,
            fecha: fechaPactada,
            tipo: "TECNICO",
            prioridad: prioridadNumerica,
          })
          .eq("id", asignacionExistente.id);

        errorAsignacion = resultado.error;
      } else {
        const resultado = await supabase
          .from("asignaciones")
          .insert({
            solicitud_id: null,
            solicitud_fabrica_id: solicitudModal.id,
            usuario_id: tecnicoId,
            fecha: fechaPactada,
            tipo: "TECNICO",
            prioridad: prioridadNumerica,
          });

        errorAsignacion = resultado.error;
      }
    } else {
      const resultado = await supabase
        .from("asignaciones")
        .upsert(
          {
            solicitud_id: solicitudModal.id,
            solicitud_fabrica_id: null,
            usuario_id: tecnicoId,
            fecha: fechaPactada,
            tipo: "TECNICO",
            prioridad: prioridadNumerica,
          },
          { onConflict: "solicitud_id" }
        );

      errorAsignacion = resultado.error;
    }

    if (errorAsignacion) {
      if (errorAsignacion.code === "23505") {
        alert(
          `El técnico ya tiene otro trabajo con prioridad ${prioridadNumerica} para ese día.`
        );
      } else {
        alert("Error al asignar el trabajo: " + errorAsignacion.message);
      }

      setGuardando(false);
      return;
    }

    // =========================================================
    // 2. ACTUALIZAR SOLICITUD
    // =========================================================

    const datosActualizacion = {
      estado: "ASIGNADO",
      fecha: fechaPactada,
      horario_desde: hDesde,
      horario_hasta: hHasta,
    };

    const tablaDestino = solicitudModal.es_fabrica
      ? "solicitudes_fabrica"
      : "solicitudes";

    const { error: errEstado } = await supabase
      .from(tablaDestino)
      .update(datosActualizacion)
      .eq("id", solicitudModal.id);

    if (errEstado) {
      alert(
        "Error al actualizar estado: " +
          errEstado.message
      );
    } else {
      cerrarModal();
      await cargarDatos();
    }

    setGuardando(false);
  }

  // =========================================================
  // ABRIR MODAL
  // =========================================================

  function abrirModal(s: any) {
    setVerDetallesModal(null);
    setSolicitudModal(s);

    setFechaPactada(
      s.fecha ||
        new Date().toISOString().split("T")[0]
    );

    setFranjaSeleccionada("DIA_COMPLETO");
    setTecnicoId("");
  }

  // =========================================================
  // CERRAR MODAL
  // =========================================================

  function cerrarModal() {
    setSolicitudModal(null);
  }

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">

      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 flex-1 p-6 md:ml-64 md:p-10">

        <h1 className="mb-2 text-3xl font-bold text-slate-900">
          Coordinación de Trabajos
        </h1>

        <p className="mb-6 text-xs text-slate-500">
          {perfil?.rol === "ADMIN"
            ? "Asigna fecha y técnico responsable para derivar las órdenes a la hoja de ruta de los camiones."
            : "Consulta de órdenes pendientes de coordinación por parte de administración."}
        </p>

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
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-10 text-sm outline-none shadow-xs focus:border-blue-500"
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

          <div className="rounded-2xl bg-white p-12 text-center shadow-xs">

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
                className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-6 shadow-xs transition hover:border-blue-400 hover:shadow-md"
              >

                {/* CABECERA */}

                <div className="mb-2 flex items-center justify-between">

                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                    #{s.numero || s.numero_remito || s.id}
                  </span>

                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      s.es_fabrica
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {s.tipo_origen}
                  </span>

                </div>

                {/* CLIENTE */}

                <h3 className="line-clamp-1 text-lg font-bold text-slate-900">
                  {s.cliente_nombre ||
                    "Cliente sin nombre"}
                </h3>

                {/* DIRECCIÓN */}

                <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                  {s.direccion}

                  {s.localidad
                    ? ` - ${s.localidad}`
                    : ""}
                </p>

                {/* =================================================
                    QUIÉN CARGÓ
                ================================================== */}

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

              <h1 className="text-2xl font-bold text-slate-900">
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

              {perfil?.rol === "ADMIN" ? (

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

                      <select
                        value={tecnicoId}
                        onChange={(e) =>
                          setTecnicoId(
                            e.target.value
                          )
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500"
                      >

                        <option value="">
                          Seleccionar técnico...
                        </option>

                        {tecnicos.map((t) => (

                          <option
                            key={t.id}
                            value={t.id}
                          >
                            👷 {t.nombre}{" "}
                            {t.apellido || ""}
                          </option>

                        ))}

                      </select>

                    </div>

                  </div>

                  {/* FRANJA */}

                  <div>

                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                      Franja Horaria
                    </label>

                    <select
                      value={franjaSeleccionada}
                      onChange={(e) =>
                        setFranjaSeleccionada(
                          e.target.value
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500"
                    >

                      <option value="MANANA">
                        🌅 Mañana (08:30 - 12:30 hs)
                      </option>

                      <option value="TARDE">
                        ☀️ Tarde (13:00 - 17:00 hs)
                      </option>

                      <option value="DIA_COMPLETO">
                        📅 Día completo (08:30 - 17:00 hs)
                      </option>

                    </select>

                  </div>

                  {/* PRIORIDAD */}

                  <div>

                    <label className="mb-1 block text-xs font-semibold uppercase text-slate-400">
                      Prioridad del recorrido
                    </label>

                    <select
                      value={prioridad}
                      onChange={(e) => setPrioridad(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-blue-500"
                    >
                      <option value="">Sin prioridad</option>
                      <option value="1">Prioridad 1</option>
                      <option value="2">Prioridad 2</option>
                      <option value="3">Prioridad 3</option>
                      <option value="4">Prioridad 4</option>
                      <option value="5">Prioridad 5</option>
                    </select>

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

                {perfil?.rol === "ADMIN" && (

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

      </main>

    </div>
  );
}