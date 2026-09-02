"use client";

import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Wrench,
  Factory,
  Truck,
  CheckCircle2,
  LogOut,
  Plus,
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
      roles: [
        "ADMIN",
        "OFICINA",
        "COORDINACION",
        "TECNICO",
        "FABRICA",
      ],
    },

    {
      nombre: "Solicitudes",
      href: "/solicitudes",
      icon: ClipboardList,
      roles: [
        "ADMIN",
        "OFICINA",
        "COORDINACION",
      ],
    },
    {
  nombre: "Listos para colocar",
  href: "/listos-para-colocar",
  icon: Truck,
  roles: ["ADMIN", "OFICINA"],
},
    {
      nombre: "Clientes",
      href: "/clientes",
      icon: Users,
      roles: [
        "ADMIN",
        "OFICINA",
        "COORDINACION",
      ],
    },

    {
      nombre: "Coordinación",
      href: "/coordinacion",
      icon: Wrench,
      roles: [
        "ADMIN",
        "COORDINACION",
      ],
    },

    {
      nombre: "Mis trabajos",
      href: "/trabajos",
      icon: Wrench,
      roles: [
        "TECNICO",
      ],
    },

    {
      nombre: "Trabajos de fábrica",
      href: "/fabrica",
      icon: Factory,
      roles: [
        "FABRICA",
      ],
    },

    {
      nombre: "Trabajos finalizados",
      href: "/finalizados",
      icon: CheckCircle2,
      roles: [
        "ADMIN",
        "OFICINA",
        "COORDINACION",
      ],
    },
  ];

  const menuVisible = menu.filter((item) =>
    item.roles.includes(rol)
  );

  const puedeCrearSolicitud = [
    "ADMIN",
    "OFICINA",
  ].includes(rol);

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white">

      {/* =========================
          LOGO
      ========================= */}

      <div className="border-b border-slate-200 p-6">
        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-xl">
            🏠
          </div>

          <div>
            <h1 className="font-bold text-slate-900">
              Cortinas Gestión
            </h1>

            <p className="text-xs text-slate-500">
              Sistema de trabajos
            </p>
          </div>

        </div>
      </div>

      {/* =========================
          NUEVA SOLICITUD
      ========================= */}

      {puedeCrearSolicitud && (
        <div className="p-4 pb-2">

          <button
            onClick={() =>
              router.push("/solicitudes/nueva")
            }
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <Plus size={18} />

            Nueva solicitud
          </button>

        </div>
      )}

      {/* =========================
          MENÚ
      ========================= */}

      <nav className="flex-1 space-y-1 overflow-y-auto p-4 pt-2">

        {menuVisible.map((item) => {

          const Icon = item.icon;

          return (
            <button
              key={item.href}
              onClick={() =>
                router.push(item.href)
              }
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <Icon size={19} />

              {item.nombre}
            </button>
          );
        })}

      </nav>

      {/* =========================
          USUARIO
      ========================= */}

      <div className="border-t border-slate-200 p-4">

        <div className="mb-3 rounded-xl bg-slate-50 p-3">

          <p className="truncate text-sm font-semibold text-slate-900">
            {nombre} {apellido}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {rol}
          </p>

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
  );
}