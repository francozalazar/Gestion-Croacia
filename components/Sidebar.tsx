"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Factory,
  LogOut,
  LayoutDashboard,
  TrendingUp,
  List,
  Hammer,
  Users,
  BarChart3,
  Menu,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/cliente";

interface SidebarProps {
  nombre: string;
  apellido: string;
  rol: string;
  seccionActiva?: string;
}

type ItemMenu = { label: string; href: string; activo: boolean };
type SeccionMenu = {
  id: string;
  titulo: string;
  icono: React.ReactNode;
  href?: string; // acceso directo, sin segunda barra
  activo: boolean;
  items: ItemMenu[];
};

// Grupo del menú al que pertenece cada ruta.
function seccionDeRuta(path: string | null): string | null {
  if (!path) return null;
  const en = (...bases: string[]) =>
    bases.some((b) => path === b || path.startsWith(b + "/"));
  if (en("/solicitudes-fabrica", "/aprobacion-fabrica", "/produccion", "/listos-para-colocar", "/trabajos-finalizados", "/stock")) return "fabrica";
  if (en("/solicitudes", "/coordinacion", "/recorrido-camiones", "/visitas-finalizadas")) return "visitas";
  if (en("/presupuestos")) return "presupuestos";
  if (en("/saldos-pendientes", "/estadisticas", "/usuarios", "/cierre-del-dia")) return "administracion";
  if (en("/clientes")) return "clientes";
  return null;
}

// En el panel del encargado la sección viene por prop (query ?seccion=),
// no por la ruta.
function seccionEncargado(seccionActiva?: string): string | null {
  const actual = seccionActiva || "";
  if (["Recorrido de camiones", "Coordinación"].includes(actual)) return "visitas";
  if (["Producción", "Stock de motores", "Instalación"].includes(actual)) return "fabrica";
  return null;
}

export default function Sidebar({ nombre, apellido, rol, seccionActiva }: SidebarProps) {
  const pathname = usePathname();
  const supabase = createClient();

  const esEncargado = rol?.toUpperCase() === "ENCARGADO";
  const esTecnico = rol?.toUpperCase() === "TECNICO";
  const esFabrica = rol?.toUpperCase() === "FABRICA";
  const esAdmin = rol === "ADMIN";

  const seccionInicial = () =>
    esEncargado ? seccionEncargado(seccionActiva) : seccionDeRuta(pathname);

  // Segunda barra visible: la sección elegida. Arranca en la de la pantalla actual.
  const [seccionVisible, setSeccionVisible] = useState<string | null>(seccionInicial);
  const [menuMovil, setMenuMovil] = useState(false);

  useEffect(() => {
    setMenuMovil(false);
    setSeccionVisible(esEncargado ? seccionEncargado(seccionActiva) : seccionDeRuta(pathname));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, seccionActiva]);

  async function handleLogout() {
    // Un celular compartido no debe conservar avisos del usuario anterior.
    if ("serviceWorker" in navigator && "PushManager" in window) {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const r = await fetch("/api/push/suscripcion", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        if (!r.ok) { alert("No se pudieron desactivar los avisos de este celular. Probá cerrar sesión otra vez."); return; }
        await sub.unsubscribe();
      }
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const enRuta = (href: string, exacto = false) =>
    exacto
      ? pathname === href
      : pathname === href || (pathname?.startsWith(href + "/") ?? false);

  const secciones: SeccionMenu[] = [];

  // Inicio siempre es acceso directo.
  secciones.push({
    id: "inicio",
    titulo: "Inicio",
    icono: <LayoutDashboard size={20} />,
    href: esEncargado ? "/encargado" : "/dashboard",
    activo: esEncargado
      ? pathname === "/encargado" && !seccionActiva
      : pathname === "/dashboard",
    items: [],
  });

  if (esEncargado) {
    const itemEnc = (t: string): ItemMenu => ({
      label: t,
      href: `/encargado?seccion=${encodeURIComponent(t)}`,
      activo: seccionActiva === t && pathname === "/encargado",
    });
    secciones.push(
      {
        id: "visitas",
        titulo: "Visitas",
        icono: <TrendingUp size={20} />,
        activo: seccionEncargado(seccionActiva) === "visitas",
        items: [itemEnc("Recorrido de camiones"), itemEnc("Coordinación")],
      },
      {
        id: "mi-recorrido",
        titulo: "Mi recorrido",
        icono: <FileText size={20} />,
        href: `/encargado?seccion=${encodeURIComponent("Mi recorrido")}`,
        activo: seccionActiva === "Mi recorrido" && pathname === "/encargado",
        items: [],
      },
      {
        id: "fabrica",
        titulo: "Fábrica",
        icono: <Factory size={20} />,
        activo: seccionEncargado(seccionActiva) === "fabrica",
        items: [itemEnc("Producción"), itemEnc("Stock de motores"), itemEnc("Instalación")],
      }
    );
  } else if (esFabrica) {
    secciones.push({
      id: "fabrica",
      titulo: "Trabajos a realizar",
      icono: <Factory size={20} />,
      href: "/fabrica",
      activo: pathname === "/fabrica",
      items: [],
    });
  } else if (esTecnico) {
    secciones.push({
      id: "trabajos",
      titulo: "Mis Trabajos",
      icono: <FileText size={20} />,
      href: "/trabajos",
      activo: enRuta("/trabajos"),
      items: [],
    });
  } else {
    // ADMIN / OFICINA. Orden pedido por Franco:
    // visitas, presupuestos, fábrica, mis clientes, administración.
    secciones.push(
      {
        id: "visitas",
        titulo: "Visitas",
        icono: <TrendingUp size={20} />,
        activo: seccionDeRuta(pathname) === "visitas",
        items: [
          { label: "Nueva solicitud", href: "/solicitudes/nueva", activo: enRuta("/solicitudes/nueva") },
          { label: "Coordinación", href: "/coordinacion", activo: enRuta("/coordinacion") },
          { label: "Recorrido de camión", href: "/recorrido-camiones", activo: enRuta("/recorrido-camiones") },
          { label: "Visitas finalizadas", href: "/visitas-finalizadas", activo: enRuta("/visitas-finalizadas") },
        ],
      },
      {
        id: "presupuestos",
        titulo: "Presupuestos",
        icono: <List size={20} />,
        activo: seccionDeRuta(pathname) === "presupuestos",
        items: [
          { label: "Presupuesto", href: "/presupuestos", activo: enRuta("/presupuestos", true) },
          ...(esAdmin
            ? [{ label: "Precio 🔒", href: "/presupuestos/precios", activo: enRuta("/presupuestos/precios") }]
            : []),
        ],
      },
      {
        id: "fabrica",
        titulo: "Fábrica",
        icono: <Hammer size={20} />,
        activo: seccionDeRuta(pathname) === "fabrica",
        items: [
          { label: "Para cortar", href: "/solicitudes-fabrica", activo: enRuta("/solicitudes-fabrica") },
          ...(esAdmin
            ? [{ label: "Aprobación 🔒", href: "/aprobacion-fabrica", activo: enRuta("/aprobacion-fabrica") }]
            : []),
          { label: "Producción", href: "/produccion", activo: enRuta("/produccion") },
          { label: "Instalación", href: "/listos-para-colocar", activo: enRuta("/listos-para-colocar") },
          { label: "Trabajos finalizados", href: "/trabajos-finalizados", activo: enRuta("/trabajos-finalizados") },
          ...(esAdmin
            ? [{ label: "Stock de motores", href: "/stock", activo: enRuta("/stock") }]
            : []),
        ],
      },
      {
        id: "clientes",
        titulo: "Mis clientes",
        icono: <Users size={20} />,
        activo: seccionDeRuta(pathname) === "clientes",
        items: [
          { label: "Mis clientes", href: "/clientes", activo: enRuta("/clientes") },
        ],
      }
    );
    if (esAdmin) {
      secciones.push({
        id: "administracion",
        titulo: "Administración",
        icono: <BarChart3 size={20} />,
        activo: seccionDeRuta(pathname) === "administracion",
        items: [
          { label: "Estadísticas", href: "/estadisticas", activo: enRuta("/estadisticas") },
          { label: "Cierre del día", href: "/cierre-del-dia", activo: enRuta("/cierre-del-dia") },
          { label: "Saldos pendientes", href: "/saldos-pendientes", activo: enRuta("/saldos-pendientes") },
          { label: "Usuarios", href: "/usuarios", activo: enRuta("/usuarios") },
        ],
      });
    }
  }

  const seccionAbierta = secciones.find(
    (s) => s.id === seccionVisible && s.items.length > 0
  );

  const tooltip = (texto: string) => (
    <span className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-white group-hover:block">
      {texto}
    </span>
  );

  const clasesIcono = (s: SeccionMenu) =>
    `group relative flex h-11 w-11 items-center justify-center rounded transition ${
      s.activo
        ? "bg-blue-600 text-white"
        : seccionVisible === s.id
          ? "bg-slate-100 text-slate-900"
          : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    }`;

  return (
    <>
      {/* BARRA SUPERIOR MÓVIL */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden">
        <button
          onClick={() => setMenuMovil(true)}
          aria-label="Abrir menú"
          className="rounded p-2 text-slate-700 hover:bg-slate-100"
        >
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="Croacia"
            className="h-8 w-8 object-contain"
          />
          <span className="text-sm font-bold text-slate-900">Croacia</span>
        </div>
      </div>

      {/* FONDO OSCURO CUANDO EL MENÚ ESTÁ ABIERTO EN MÓVIL */}
      {menuMovil && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMenuMovil(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen transform transition-transform duration-200 md:translate-x-0 ${
          menuMovil ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* BARRA PRIMARIA: SOLO ÍCONOS */}
        <div className="flex h-full w-16 shrink-0 flex-col items-center border-r border-slate-200 bg-white py-4">
          <Link
            href={esEncargado ? "/encargado" : "/dashboard"}
            aria-label="Inicio"
            className="mb-4"
          >
            <img
              src="/logo.png"
              alt="Croacia"
              className="h-10 w-10 object-contain"
            />
          </Link>

          <nav className="flex flex-1 flex-col items-center gap-2">
            {secciones.map((s) => {
              const contenido = (
                <>
                  {s.icono}
                  {tooltip(s.titulo)}
                </>
              );
              if (s.href) {
                return (
                  <Link
                    key={s.id}
                    href={s.href}
                    aria-label={s.titulo}
                    className={clasesIcono(s)}
                  >
                    {contenido}
                  </Link>
                );
              }
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-label={s.titulo}
                  aria-expanded={seccionVisible === s.id}
                  onClick={() =>
                    setSeccionVisible(seccionVisible === s.id ? null : s.id)
                  }
                  className={clasesIcono(s)}
                >
                  {contenido}
                </button>
              );
            })}
          </nav>

          <button
            onClick={handleLogout}
            aria-label="Cerrar sesión"
            className="group relative flex h-11 w-11 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <LogOut size={20} />
            {tooltip("Cerrar sesión")}
          </button>
        </div>

        {/* BARRA SECUNDARIA: OPCIONES DE LA SECCIÓN ELEGIDA */}
        {seccionAbierta && (
          <div className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
            <div className="flex items-center justify-between px-5 pb-4 pt-6">
              <h2 className="text-lg font-bold text-slate-900">
                {seccionAbierta.titulo}
              </h2>
              <button
                onClick={() => setSeccionVisible(null)}
                aria-label="Cerrar sección"
                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto px-3">
              {seccionAbierta.items.map((it) => (
                <Link
                  key={it.href + it.label}
                  href={it.href}
                  className={`block px-3 py-2.5 text-sm transition ${
                    it.activo
                      ? "font-semibold text-blue-600"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  • {it.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">
                {nombre} {apellido}
              </p>
              <p className="text-xs uppercase text-slate-400">{rol}</p>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
