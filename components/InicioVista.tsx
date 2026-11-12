"use client";

import AvisosAndroid from "@/components/AvisosAndroid";
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
  ShieldAlert,
  X,
} from "lucide-react";


// Pantalla de Inicio / Panel principal. La misma para todos los roles; el padre
// calcula los datos (perfil, métricas, avisos) y esta vista sólo los dibuja.
export default function InicioVista(props: any) {
  const { perfil, stockBajo, errorStock, paraHoy, metricasAdmin, metricasTecnico, metricasFabrica, metricasProduccion, notificaciones, errorAvisos, novedadEnVivo, setNovedadEnVivo, cargando, rutas, barraProduccion, rolMostrado } = props;
  // Permite que otro rol (encargado) apunte los mismos enlaces a sus pantallas internas.
  const r = (h: string): string => (rutas && rutas[h]) || h;
  const esTecnico = perfil?.rol?.toUpperCase() === "TECNICO";
  const esFabrica = perfil?.rol?.toUpperCase() === "FABRICA";
  const esAdminOficina = ["ADMIN", "OFICINA", "COORDINACION"].includes(perfil?.rol?.toUpperCase() || "");
  return (
    <>
        {/* ENCABEZADO */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-slate-400">Bienvenido nuevamente</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Panel principal</h1>
        </div>

        {perfil?.rol?.toUpperCase() === "ADMIN" && (stockBajo.length > 0 || errorStock) && (
          <section className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5" aria-label="Aviso de stock de motores">
            <h2 className="text-base font-bold text-red-800">{errorStock ? "No se pudo consultar el stock" : "Motores por agotarse"}</h2>
            {errorStock ? <p className="mt-2 text-sm text-red-700">Revisá Stock de motores para comprobar las cantidades.</p> : (
              <ul className="mt-2 space-y-1 text-sm text-red-800">
                {stockBajo.map((m: any) => <li key={m.id}><strong>{m.nombre}</strong>: quedan {m.cantidad} · aviso en {m.minimo}</li>)}
              </ul>
            )}
            <Link href={r("/stock")} className="mt-3 inline-flex text-sm font-semibold text-red-800 underline">Ver stock de motores</Link>
          </section>
        )}

        {["TECNICO", "OFICINA", "ADMIN", "FABRICA"].includes(perfil?.rol?.toUpperCase() || "") && <AvisosAndroid />}

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
              {paraHoy.map((t: any) => (
                <Link
                  key={t.id}
                  href={r(t.link)}
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
              <p className="text-xs font-medium text-slate-400">Asignados para hoy</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasTecnico.asignadas}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Pendientes de hoy</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{metricasTecnico.pendientes}</p>
            </div>
            <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-100">
              <p className="text-xs font-medium text-slate-400">Finalizados de hoy</p>
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

        {(esAdminOficina || barraProduccion) && (
          <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Producción en fábrica
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Estado de los trabajos</h2>
              </div>
              <Link
                href={r("/produccion")}
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
                Panel de trabajo para el rol de <strong className="text-slate-800">{rolMostrado || perfil?.rol || "TECNICO"}</strong>.
              </p>
            </div>

            <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-100">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                Accesos Directos
              </h3>
              <div className="flex flex-col gap-2.5">
                {perfil?.rol?.toUpperCase() === "FABRICA" ? (
                  <Link
                    href={r("/fabrica")}
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
                      href={r("/trabajos")}
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
                      href={r("/solicitudes/nueva")}
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
                      href={r("/presupuestos")}
                      className="flex items-center justify-between rounded-xl bg-emerald-50 text-emerald-700 px-4 py-3 text-xs font-semibold hover:bg-emerald-100 transition border border-emerald-100"
                    >
                      <span className="flex items-center gap-2"><Inbox size={16} /> Inbox Presupuestos</span>
                      <ArrowRight size={14} />
                    </Link>

                    <Link
                      href={r("/produccion")}
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

            {errorAvisos && <p role="alert" className="mb-3 text-xs text-red-700">No se pudieron cargar los avisos de asignación. Volvé a Inicio para reintentar.</p>}
            {cargando ? (
              <p className="text-center text-xs text-slate-400 py-8">Cargando información...</p>
            ) : notificaciones.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                No hay notificaciones pendientes en este momento.
              </div>
            ) : (
              <div className="space-y-3">
                {notificaciones.map((n: any) => {
                  const Icono = n.icono;
                  return (
                    <Link
                      key={n.id}
                      href={r(n.link)}
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

        {/* AVISO EN VIVO: aparece en el momento si la página está abierta */}
        {novedadEnVivo && (
          <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 z-50 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl shrink-0 ${novedadEnVivo.colorIcono}`}>
                <Bell size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Novedad
                </p>
                <Link href={r(novedadEnVivo.link)} className="block">
                  <p className="text-sm font-bold text-slate-800 hover:text-blue-600">
                    {novedadEnVivo.titulo}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{novedadEnVivo.detalle}</p>
                </Link>
              </div>
              <button
                onClick={() => setNovedadEnVivo(null)}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
    </>
  );
}
