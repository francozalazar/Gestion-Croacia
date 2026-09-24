"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import {
  Bell,
  DollarSign,
  CheckCircle2,
  Wrench,
  Plus,
  Truck,
  Inbox,
  ArrowRight,
  ClipboardList,
  MapPin,
  Calendar,
  Factory,
} from "lucide-react";

export default function DashboardPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [metricasAdmin, setMetricasAdmin] = useState({
    solicitudes: 0,
    pendientes: 0,
    enProceso: 0,
    finalizados: 0,
  });
  const [metricasTecnico, setMetricasTecnico] = useState({
    asignadas: 0,
    pendientes: 0,
    finalizados: 0,
  });
  const [metricasFabrica, setMetricasFabrica] = useState({
    pendientes: 0,
    enProceso: 0,
    faltantes: 0,
  });
  const [metricasProduccion, setMetricasProduccion] = useState({
    pendientes: 0,
    enProceso: 0,
    faltantes: 0,
    anulados: 0,
  });
  const [notificaciones, setNotificaciones] = useState<any[]>([]);
  const [paraHoy, setParaHoy] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDashboard();
  }, []);

  async function cargarDashboard() {
    setCargando(true);

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

    const ahora = new Date();
    const hoy = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;

    const esTecnico = profile?.rol?.toUpperCase() === "TECNICO";

    if (profile?.rol?.toUpperCase() === "FABRICA") {
      const { data: trabajosFabrica } = await supabase
        .from("solicitudes_fabrica")
        .select("*")
        .in("estado", [
          "ENVIADO_A_CORTAR",
          "EN_CORTE",
          "EN_FABRICACION",
          "EN_FABRICA",
          "FALTANTES",
        ])
        .order("created_at", { ascending: false });

      const trabajos = trabajosFabrica || [];

      setMetricasFabrica({
        pendientes: trabajos.filter((t) =>
          ["ENVIADO_A_CORTAR", "EN_CORTE"].includes(t.estado)
        ).length,
        enProceso: trabajos.filter((t) =>
          t.estado === "EN_FABRICACION" || t.estado === "EN_FABRICA"
        ).length,
        faltantes: trabajos.filter((t) => t.estado === "FALTANTES").length,
      });

      setParaHoy(
        trabajos
          .filter((t) =>
            ["FALTANTES", "ENVIADO_A_CORTAR", "EN_CORTE"].includes(t.estado)
          )
          .slice(0, 6)
          .map((t) => ({
            id: `hoy-fab-${t.id}`,
            titulo: `Remito #${t.numero_remito || t.id} - ${t.cliente_nombre || "Cliente"}`,
            detalle: (t.estado || "").replaceAll("_", " "),
            link: "/fabrica",
          }))
      );

      setNotificaciones(
        trabajos.slice(0, 8).map((trabajo) => ({
          id: `fabrica-${trabajo.id}`,
          titulo: "Te asignaron un trabajo nuevo",
          detalle: `Remito #${trabajo.numero_remito || trabajo.id} - ${
            trabajo.cliente_nombre || "Cliente sin nombre"
          }`,
          fecha: trabajo.created_at,
          link: "/fabrica",
          icono: Factory,
          colorIcono: "bg-amber-100 text-amber-600",
        }))
      );

      setCargando(false);
      return;
    }

    if (esTecnico) {
      // 1. DATOS ESPECÍFICOS PARA TÉCNICO
      const { data: asignaciones } = await supabase
        .from("asignaciones")
        .select("*")
        .eq("usuario_id", user.id);

      const listaAsignaciones = asignaciones || [];
      const solicitudIds = listaAsignaciones
        .map((a: any) => a.solicitud_id)
        .filter(Boolean);
      const solicitudFabricaIds = listaAsignaciones
        .map((a: any) => a.solicitud_fabrica_id)
        .filter(Boolean);

      const [{ data: solBase }, { data: solFab }] = await Promise.all([
        solicitudIds.length
          ? supabase.from("solicitudes").select("*").in("id", solicitudIds)
          : Promise.resolve({ data: [] as any[] }),
        solicitudFabricaIds.length
          ? supabase.from("solicitudes_fabrica").select("*").in("id", solicitudFabricaIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const solicitudesTecnico: any[] = [
        ...(solBase || []),
        ...(solFab || []),
      ];

      const deHoy = listaAsignaciones.filter((a: any) => a.fecha === hoy);
      setParaHoy(
        solicitudesTecnico
          .filter((s: any) =>
            deHoy.some(
              (a: any) =>
                a.solicitud_id === s.id || a.solicitud_fabrica_id === s.id
            )
          )
          .slice(0, 6)
          .map((s: any) => ({
            id: `hoy-tec-${s.id}-${s.numero_remito ? "f" : "v"}`,
            titulo: `${s.numero_remito ? "Remito" : "Visita"} #${s.numero_remito || s.numero || s.id} - ${s.cliente_nombre || "Cliente"}`,
            detalle: s.direccion || "Sin dirección",
            link: "/trabajos",
          }))
      );

      setMetricasTecnico({
        asignadas: solicitudesTecnico.length,
        pendientes: solicitudesTecnico.filter((s: any) => s.estado !== "FINALIZADO").length,
        finalizados: solicitudesTecnico.filter((s: any) => s.estado === "FINALIZADO").length,
      });

      // 2. ALERTAS PERSONALIZADAS PARA EL TÉCNICO
      const eventos: any[] = solicitudesTecnico
        .filter((s: any) => s.estado !== "FINALIZADO")
        .map((s: any) => ({
          id: `tec-${s.id}`,
          titulo: "¡Se te asignó un nuevo trabajo!",
          detalle: `Cliente: ${s.cliente_nombre || "Sin nombre"} | Dirección: ${s.direccion || "Sin dirección"}`,
          fecha: s.updated_at || s.created_at,
          link: "/tecnico/trabajos",
          icono: Wrench,
          colorIcono: "bg-blue-100 text-blue-600",
        }));

      eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setNotificaciones(eventos.slice(0, 8));

    } else {
      // DATOS PARA ADMIN / OFICINA
      // Oficina ve solo lo que cargó; admin y coordinación ven todo.
      const esOficina = profile?.rol?.toUpperCase() === "OFICINA";

      let consultaSolicitudes = supabase
        .from("solicitudes")
        .select("*")
        .order("created_at", { ascending: false });

      if (esOficina) {
        consultaSolicitudes = consultaSolicitudes.eq("creado_por", user.id);
      }

      const { data: solicitudes } = await consultaSolicitudes;

      const { data: trabajosFabrica } = await supabase
        .from("solicitudes_fabrica")
        .select("*")
        .in("estado", [
          "ENVIADO_A_CORTAR",
          "EN_CORTE",
          "EN_FABRICACION",
          "EN_FABRICA",
          "FALTANTES",
          "LISTO_PARA_COLOCAR",
          "ANULADO",
        ])
        .order("created_at", { ascending: false });

      const lista = solicitudes || [];
      const trabajos = trabajosFabrica || [];

      const { data: asignacionesHoy } = await supabase
        .from("asignaciones")
        .select("solicitud_id, solicitud_fabrica_id")
        .eq("fecha", hoy);

      const idsHoy = new Set(
        (asignacionesHoy || [])
          .map((a: any) => a.solicitud_id)
          .filter(Boolean)
      );

      setParaHoy(
        lista
          .filter((s) => idsHoy.has(s.id))
          .slice(0, 6)
          .map((s) => ({
            id: `hoy-adm-${s.id}`,
            titulo: `Visita #${s.numero || s.id} - ${s.cliente_nombre || "Cliente"}`,
            detalle: s.direccion || "Sin dirección",
            link: "/coordinacion",
          }))
      );

      setMetricasAdmin({
        solicitudes: lista.length,
        pendientes: lista.filter((s) => s.estado === "PENDIENTE" || s.estado === "PENDIENTE_COORDINACION").length,
        enProceso: lista.filter((s) => s.estado === "EN_PROCESO" || s.estado === "ASIGNADO").length,
        finalizados: lista.filter((s) => s.estado === "FINALIZADO" || s.estado === "PRESUPUESTADO").length,
      });

      setMetricasProduccion({
        pendientes: trabajos.filter((t) => ["ENVIADO_A_CORTAR", "EN_CORTE"].includes(t.estado)).length,
        enProceso: trabajos.filter((t) => ["EN_FABRICACION", "EN_FABRICA", "LISTO_PARA_COLOCAR"].includes(t.estado)).length,
        faltantes: trabajos.filter((t) => t.estado === "FALTANTES").length,
        anulados: trabajos.filter((t) => t.estado === "ANULADO").length,
      });

      const eventos: any[] = [];

      lista.forEach((s) => {
        if (s.estado === "PRESUPUESTADO") {
          eventos.push({
            id: `presupuesto-${s.id}`,
            titulo: `Precio asignado en Remito #${String(s.numero || s.id).padStart(5, "0")}`,
            detalle: `Cliente: ${s.cliente_nombre || "Cliente"} - Monto: $${(s.subtotal || s.precio || 0).toLocaleString()}`,
            fecha: s.updated_at || s.created_at,
            link: "/presupuestos",
            icono: DollarSign,
            colorIcono: "bg-emerald-100 text-emerald-600",
          });
        }

        if (s.estado === "FINALIZADO") {
          eventos.push({
            id: `finalizado-${s.id}`,
            titulo: `Trabajo finalizado #${String(s.numero || s.id).padStart(5, "0")}`,
            detalle: `Técnico completó la visita en ${s.direccion}`,
            fecha: s.updated_at || s.created_at,
            link: "/visitas-finalizadas",
            icono: CheckCircle2,
            colorIcono: "bg-blue-100 text-blue-600",
          });
        }
      });

      eventos.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
      setNotificaciones(eventos.slice(0, 8));
    }

    setCargando(false);
  }

  const esTecnico = perfil?.rol?.toUpperCase() === "TECNICO";
  const esFabrica = perfil?.rol?.toUpperCase() === "FABRICA";
  const esAdminOficina = ["ADMIN", "OFICINA", "COORDINACION"].includes(perfil?.rol?.toUpperCase() || "");

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 pt-20 md:p-10">
        {/* ENCABEZADO */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400">Bienvenido nuevamente</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Panel principal</h1>
        </div>

        {/* LO URGENTE DE HOY */}
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
          {cargando ? (
            <p className="py-3 text-center text-xs text-slate-400">Cargando...</p>
          ) : paraHoy.length === 0 ? (
            <p className="py-3 text-center text-xs text-slate-400">
              Nada urgente para hoy.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {paraHoy.map((t) => (
                <Link
                  key={t.id}
                  href={t.link}
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:bg-slate-50/60 rounded-lg px-2 -mx-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {t.titulo}
                    </p>
                    <p className="truncate text-xs text-slate-500">{t.detalle}</p>
                  </div>
                  <ArrowRight size={14} className="shrink-0 text-slate-300" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* MÉTRICAS */}
        {esFabrica ? (
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Pendientes de corte</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasFabrica.pendientes}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">En producción</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasFabrica.enProceso}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Faltantes</p>
              <p className="text-3xl font-bold text-amber-600 mt-1">{metricasFabrica.faltantes}</p>
            </div>
          </div>
        ) : esTecnico ? (
          <div className="grid gap-4 sm:grid-cols-3 mb-8">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Total Asignados</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasTecnico.asignadas}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Pendientes de Realizar</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasTecnico.pendientes}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Trabajos Finalizados</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasTecnico.finalizados}</p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Solicitudes</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasAdmin.solicitudes}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Pendientes</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasAdmin.pendientes}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">En proceso</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasAdmin.enProceso}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Finalizados</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasAdmin.finalizados}</p>
            </div>
          </div>
        )}

        {esAdminOficina && (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Producción en fábrica
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Estado de los trabajos</h2>
              </div>
              <Link
                href="/produccion"
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Ver todos
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Pendientes</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{metricasProduccion.pendientes}</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-4">
                <p className="text-xs text-blue-700">En producción</p>
                <p className="mt-2 text-2xl font-bold text-blue-700">{metricasProduccion.enProceso}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4">
                <p className="text-xs text-amber-700">Faltantes</p>
                <p className="mt-2 text-2xl font-bold text-amber-700">{metricasProduccion.faltantes}</p>
              </div>
              <div className="rounded-xl bg-red-50 p-4">
                <p className="text-xs text-red-700">Anulados</p>
                <p className="mt-2 text-2xl font-bold text-red-700">{metricasProduccion.anulados}</p>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN PRINCIPAL: ACCESOS RÁPIDOS + NOTIFICACIONES */}
        <div className="grid gap-8 lg:grid-cols-3">
          
          {/* COLUMNA IZQUIERDA: BIENVENIDA & ACCESOS */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">Hola, {perfil?.nombre || "Usuario"}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Panel de trabajo para el rol de <strong className="text-slate-800">{perfil?.rol || "TECNICO"}</strong>.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Accesos Directos
              </h3>
              <div className="flex flex-col gap-2.5">
                {perfil?.rol?.toUpperCase() === "FABRICA" ? (
                  <Link
                    href="/fabrica"
                    className="flex items-center justify-between rounded-xl bg-amber-600 px-4 py-3 text-xs font-semibold text-white hover:bg-amber-700 transition"
                  >
                    <span className="flex items-center gap-2">
                      <Factory size={16} />
                      Ver trabajos a realizar
                    </span>
                    <ArrowRight size={14} />
                  </Link>
                ) : esTecnico ? (
                  <>
                    <Link
                      href="/trabajos"
                      className="flex items-center justify-between rounded-xl bg-blue-600 px-4 py-3 text-xs font-semibold text-white hover:bg-blue-700 transition"
                    >
                      <span className="flex items-center gap-2"><ClipboardList size={16} /> Ver Mis Trabajos Pendientes</span>
                      <ArrowRight size={14} />
                    </Link>

                    <Link
                      href="/recorrido-camiones"
                      className="flex items-center justify-between rounded-xl bg-slate-100 text-slate-700 px-4 py-3 text-xs font-semibold hover:bg-slate-200 transition border border-slate-200"
                    >
                      <span className="flex items-center gap-2"><Truck size={16} /> Consultar Mi Recorrido</span>
                      <ArrowRight size={14} />
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/solicitudes/nueva"
                      className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white hover:bg-slate-800 transition"
                    >
                      <span className="flex items-center gap-2"><Plus size={16} /> Nueva Solicitud</span>
                      <ArrowRight size={14} />
                    </Link>

                    <Link
                      href="/recorrido-camiones"
                      className="flex items-center justify-between rounded-xl bg-blue-50 text-blue-700 px-4 py-3 text-xs font-semibold hover:bg-blue-100 transition border border-blue-100"
                    >
                      <span className="flex items-center gap-2"><Truck size={16} /> Recorrido de Camiones</span>
                      <ArrowRight size={14} />
                    </Link>

                    <Link
                      href="/presupuestos"
                      className="flex items-center justify-between rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-xs font-semibold hover:bg-emerald-100 transition border border-emerald-100"
                    >
                      <span className="flex items-center gap-2"><Inbox size={16} /> Inbox Presupuestos</span>
                      <ArrowRight size={14} />
                    </Link>

                    <Link
                      href="/produccion"
                      className="flex items-center justify-between rounded-xl bg-amber-50 text-amber-700 px-4 py-3 text-xs font-semibold hover:bg-amber-100 transition border border-amber-100"
                    >
                      <span className="flex items-center gap-2"><Factory size={16} /> Producción en Fábrica</span>
                      <ArrowRight size={14} />
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: NOTIFICACIONES / ALERTAS */}
          <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {esTecnico ? "Nuevos Trabajos Asignados" : "Novedades y Notificaciones"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {esTecnico ? "Avisos de tareas listas para realizar" : "Cambios de estado e ingresos recientes"}
                  </p>
                </div>
              </div>
            </div>

            {cargando ? (
              <p className="text-center text-xs text-slate-400 py-8">Cargando información...</p>
            ) : notificaciones.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No hay notificaciones pendientes en este momento.
              </div>
            ) : (
              <div className="space-y-3">
                {notificaciones.map((n) => {
                  const Icono = n.icono;
                  return (
                    <Link
                      key={n.id}
                      href={n.link}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50/80 transition group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className={`p-2.5 rounded-xl shrink-0 ${n.colorIcono}`}>
                          <Icono size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
                            {n.titulo}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">{n.detalle}</p>
                        </div>
                      </div>

                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {new Date(n.fecha).toLocaleDateString("es-AR", {
                          day: "2-digit",
                          month: "2-digit",
                        })}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
