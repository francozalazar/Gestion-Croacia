"use client";

import { useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Factory,
  Truck,
  CheckCircle2,
  LogOut,
  Plus,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";

interface SidebarProps {
  nombre: string;
  apellido?: string;
  rol: string;
}

export default function Sidebar({
  nombre,
  apellido,
  rol,
}: SidebarProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isOpen, setIsOpen] = useState(false);

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  const menu = [
    {
      nombre: "Inicio",
      href: "/dashboard",
      icon: LayoutDashboard,
      roles: ["ADMIN", "OFICINA", "COORDINACION", "TECNICO", "FABRICA"],
    },
    {
      nombre: "Solicitudes",
      href: "/solicitudes",
      icon: ClipboardList,
      roles: ["ADMIN", "OFICINA", "COORDINACION"],
    },
    {
  nombre: "Solicitudes para fábrica",
  href: "/solicitudes-fabrica",
  icon: Factory,
  roles: ["ADMIN", "OFICINA"],
},
{
  nombre: "Aprobación fábrica",
  href: "/aprobacion-fabrica",
  icon: Factory,
  roles: ["ADMIN"],
},
    {
      nombre: "Listos para colocar",
      href: "/listos-para-colocar",
      icon: Truck,
      roles: ["ADMIN", "OFICINA"],
    },
    {
      nombre: "Coordinación",
      href: "/coordinacion",
      icon: Wrench,
      roles: ["ADMIN", "COORDINACION"],
    },
    {
      nombre: "Mis trabajos",
      href: "/trabajos",
      icon: Wrench,
      roles: ["TECNICO"],
    },
    {
      nombre: "Trabajos de fábrica",
      href: "/fabrica",
      icon: Factory,
      roles: ["FABRICA"],
    },
    {
      nombre: "Trabajos finalizados",
      href: "/finalizados",
      icon: CheckCircle2,
      roles: ["ADMIN", "OFICINA", "COORDINACION"],
    },
  ];

  const menuVisible = menu.filter((item) =>
    item.roles.includes(rol)
  );

  const puedeCrearSolicitud = ["ADMIN", "OFICINA"].includes(rol);

  return (
    <>
      {/* BARRA SUPERIOR MOBILE: Siempre visible arriba en celulares */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 md:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-lg">
            🏠
          </div>
          <span className="font-bold text-slate-900 text-sm">Cortinas Gestión</span>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="rounded-xl p-2 text-slate-700 hover:bg-slate-100 focus:outline-none"
          aria-label="Abrir menú"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* FONDO OSCURO (OVERLAY): Solo aparece en mobile cuando el menú está abierto */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* ASIDE (SIDEBAR): Oculto por defecto en mobile (-translate-x-full), fijo a la izquierda en PC (md:translate-x-0) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* LOGO (Solo en PC, en mobile ya está en la barra superior) */}
        <div className="hidden border-b border-slate-200 p-6 md:block">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xl">
              🏠
            </div>
            <div>
              <h1 className="font-bold text-slate-900">Cortinas Gestión</h1>
              <p className="text-xs text-slate-500">Sistema de trabajos</p>
            </div>
          </div>
        </div>

        {/* Espaciador superior para que en mobile el contenido no quede debajo de la barra fija */}
        <div className="h-16 md:hidden" />

        {/* NUEVA SOLICITUD */}
        {puedeCrearSolicitud && (
          <div className="p-4 pb-2">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push("/solicitudes/nueva");
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus size={18} />
              Nueva solicitud
            </button>
          </div>
        )}

        {/* MENÚ DE NAVEGACIÓN */}
        <nav className="flex-1 space-y-1 overflow-y-auto p-4 pt-2">
          {menuVisible.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onClick={() => {
                  setIsOpen(false);
                  router.push(item.href);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <Icon size={19} />
                {item.nombre}
              </button>
            );
          })}
        </nav>

        {/* USUARIO Y CERRAR SESIÓN */}
        <div className="border-t border-slate-200 p-4">
          <div className="mb-3 rounded-xl bg-slate-50 p-3">
            <p className="truncate text-sm font-semibold text-slate-900">
              {nombre} {apellido}
            </p>
            <p className="mt-1 text-xs text-slate-500">{rol}</p>
          </div>

          <button
            onClick={cerrarSesion}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
          >
            <LogOut size={19} />
            Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}