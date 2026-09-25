"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Factory,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  TrendingUp,
  List,
  Hammer,
  Users,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/cliente";

interface SidebarProps {
  nombre: string;
  apellido: string;
  rol: string;
}

export default function Sidebar({ nombre, apellido, rol }: SidebarProps) {
  const pathname = usePathname();
  const supabase = createClient();

  const [seccionAbierta, setSeccionAbierta] = useState<string | null>("visitas");
  const [menuMovil, setMenuMovil] = useState(false);

  useEffect(() => {
    setMenuMovil(false);
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const toggleSeccion = (nombreSeccion: string) => {
    setSeccionAbierta(seccionAbierta === nombreSeccion ? null : nombreSeccion);
  };

  const esTecnico = rol?.toUpperCase() === "TECNICO";
  const esFabrica = rol?.toUpperCase() === "FABRICA";
  const esAdminOficina = ["ADMIN", "OFICINA"].includes(rol?.toUpperCase() || "");

  return (
    <>
      {/* BARRA SUPERIOR MÓVIL */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 bg-slate-900 px-4 text-white md:hidden">
        <button
          onClick={() => setMenuMovil(true)}
          aria-label="Abrir menú"
          className="rounded-lg p-2 hover:bg-slate-800"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Croacia"
            className="h-8 w-8 rounded-lg bg-white object-contain p-0.5"
          />
          <span className="text-sm font-bold">Croacia</span>
        </div>
      </div>

      {/* FONDO OSCURO CUANDO EL MENÚ ESTÁ ABIERTO EN MÓVIL */}
      {menuMovil && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMenuMovil(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 z-40 h-screen w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 transform transition-transform duration-200 md:translate-x-0 ${
        menuMovil ? "translate-x-0" : "-translate-x-full"
      }`}>
      <div className="p-5">
        <button
          onClick={() => setMenuMovil(false)}
          aria-label="Cerrar menú"
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
        >
          <X size={18} />
        </button>
        {/* LOGO */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-5 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white p-1">
            <img
              src="/logo.png"
              alt="Croacia"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <h2 className="font-bold text-white text-sm">Croacia</h2>
            <p className="text-xs text-slate-400 uppercase">{rol}</p>
          </div>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="space-y-2">
          {/* Dashboard General */}
          <Link
            href="/dashboard"
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
              pathname === "/dashboard"
                ? "bg-blue-600 text-white"
                : "hover:bg-slate-800 hover:text-white"
            }`}
          >
            <LayoutDashboard size={18} />
            <span>Inicio</span>
          </Link>

          {/* MENÚ CONDICIONAL SEGÚN EL ROL */}
          {esFabrica ? (
            <div className="pt-2">
              <Link
                href="/fabrica"
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  pathname === "/fabrica"
                    ? "bg-amber-600 text-white"
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Factory size={18} className="text-amber-400" />
                <span>Trabajos a realizar</span>
              </Link>
              <Link
                href="/produccion"
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  pathname === "/produccion"
                    ? "bg-amber-600 text-white"
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Hammer size={18} className="text-amber-400" />
                <span>Producción</span>
              </Link>
              <Link
                href="/visitas-finalizadas"
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  pathname === "/visitas-finalizadas"
                    ? "bg-amber-600 text-white"
                    : "hover:bg-slate-800 hover:text-white"
                }`}
              >
                <FileText size={18} className="text-amber-400" />
                <span>Visitas finalizadas</span>
              </Link>
            </div>
          ) : esTecnico ? (
            /* MENÚ EXCLUSIVO PARA TÉCNICOS */
            <div className="pt-2">
              <button
                onClick={() => toggleSeccion("trabajos")}
                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-800 hover:text-white transition"
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-blue-400" />
                  <span>Mis Trabajos</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${
                    seccionAbierta === "trabajos" ? "rotate-180" : ""
                  }`}
                />
              </button>

              {seccionAbierta === "trabajos" && (
                <div className="ml-8 mt-1 space-y-1 border-l border-slate-800 pl-3">
                  <Link
                    href="/trabajos"
                    className={`block py-2 text-xs font-medium transition ${
                      pathname === "/trabajos"
                        ? "text-blue-400 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    • Trabajos asignados
                  </Link>
                  <Link
                    href="/visitas-finalizadas"
                    className={`block py-2 text-xs font-medium transition ${
                      pathname === "/visitas-finalizadas"
                        ? "text-blue-400 font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    • Visitas finalizadas
                  </Link>
                </div>
              )}
            </div>
          ) : (
            /* MENÚ COMPLETO PARA ADMIN / OFICINA */
            <>
              {/* 1. GRUPO: VISITAS */}
              <div className="pt-2">
                <button
                  onClick={() => toggleSeccion("visitas")}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-800 hover:text-white transition"
                >
                  <div className="flex items-center gap-3">
                    <TrendingUp size={18} className="text-blue-400" />
                    <span>Visitas</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${
                      seccionAbierta === "visitas" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {seccionAbierta === "visitas" && (
                  <div className="ml-8 mt-1 space-y-1 border-l border-slate-800 pl-3">
                    <Link
                      href="/solicitudes/nueva"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/solicitudes/nueva"
                          ? "text-blue-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Nueva solicitud
                    </Link>
                    
                    <Link
                      href="/coordinacion"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/coordinacion"
                          ? "text-blue-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Coordinación
                    </Link>
                    
                    <Link
                      href="/recorrido-camiones"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/recorrido-camiones"
                          ? "text-blue-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Recorrido de camión
                    </Link>
                    
                    <Link
                      href="/visitas-finalizadas"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/visitas-finalizadas"
                          ? "text-blue-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Visitas finalizadas
                    </Link>
                  </div>
                )}
              </div>

              {/* GRUPO: CLIENTES */}
              <div className="pt-2">
                <button
                  onClick={() => toggleSeccion("clientes")}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-800 hover:text-white transition"
                >
                  <div className="flex items-center gap-3">
                    <Users size={18} className="text-violet-400" />
                    <span>Clientes</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${
                      seccionAbierta === "clientes" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {seccionAbierta === "clientes" && (
                  <div className="ml-8 mt-1 space-y-1 border-l border-slate-800 pl-3">
                    <Link
                      href="/clientes"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/clientes"
                          ? "text-violet-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Mis clientes
                    </Link>
                  </div>
                )}
              </div>

              {/* 2. GRUPO: PRESUPUESTOS */}
              <div className="pt-2">
                <button
                  onClick={() => toggleSeccion("presupuestos")}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-800 hover:text-white transition"
                >
                  <div className="flex items-center gap-3">
                    <List size={18} className="text-emerald-400" />
                    <span>Presupuestos</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${
                      seccionAbierta === "presupuestos" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {seccionAbierta === "presupuestos" && (
                  <div className="ml-8 mt-1 space-y-1 border-l border-slate-800 pl-3">
                    <Link
                      href="/presupuestos"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/presupuestos"
                          ? "text-emerald-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Presupuesto
                    </Link>

                    {rol === "ADMIN" && (
                      <Link
                        href="/presupuestos/precios"
                        className={`block py-2 text-xs font-medium transition ${
                          pathname === "/presupuestos/precios"
                            ? "text-emerald-400 font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        • Precio 🔒
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* 3. GRUPO: FÁBRICA */}
              <div className="pt-2">
                <button
                  onClick={() => toggleSeccion("fabrica")}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium hover:bg-slate-800 hover:text-white transition"
                >
                  <div className="flex items-center gap-3">
                    <Hammer size={18} className="text-amber-400" />
                    <span>Fábrica</span>
                  </div>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${
                      seccionAbierta === "fabrica" ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {seccionAbierta === "fabrica" && (
                  <div className="ml-8 mt-1 space-y-1 border-l border-slate-800 pl-3">
                    <Link
                      href="/solicitudes-fabrica"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/solicitudes-fabrica"
                          ? "text-amber-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Solicitudes para fábrica
                    </Link>

                    {rol === "ADMIN" && (
                      <Link
                        href="/aprobacion-fabrica"
                        className={`block py-2 text-xs font-medium transition ${
                          pathname === "/aprobacion-fabrica"
                            ? "text-amber-400 font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        • Aprobación 🔒
                      </Link>
                    )}

                    <Link
                      href="/produccion"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/produccion"
                          ? "text-amber-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Producción
                    </Link>

                    <Link
                      href="/listos-para-colocar"
                      className={`block py-2 text-xs font-medium transition ${
                        pathname === "/listos-para-colocar"
                          ? "text-amber-400 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      • Listos para colocar
                    </Link>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
      </div>

      {/* FOOTER PERFIL Y LOGOUT */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{nombre} {apellido}</p>
            <p className="text-xs text-slate-500">{rol}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
    </>
  );
}
