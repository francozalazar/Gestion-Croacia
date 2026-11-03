"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import InicioVista from "@/components/InicioVista";
import AvisosAndroid from "@/components/AvisosAndroid";
import { avisoAsignacionVendedor } from "@/lib/avisosVendedor";
import { requierePrecio } from "@/lib/tipoVisita";
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
  const avisosAsignacionConocidos = useRef(new Set<string>());
  const eventosAsignacionAnunciados = useRef(new Set<string>());
  const [errorAvisos, setErrorAvisos] = useState(false);
  const [novedadEnVivo, setNovedadEnVivo] = useState<any | null>(null);
  const [stockBajo, setStockBajo] = useState<{ id: number; nombre: string; cantidad: number; minimo: number }[]>([]);
  const [errorStock, setErrorStock] = useState(false);
  const [paraHoy, setParaHoy] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarDashboard();
  }, []);

  // Volver a Inicio o recuperar el foco actualiza la agenda del día.
  useEffect(() => {
    if (!["TECNICO", "ADMIN", "OFICINA", "COORDINACION"].includes(perfil?.rol?.toUpperCase() || "")) return;
    const actualizar = () => { if (document.visibilityState === "visible") cargarDashboard(); };
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.removeEventListener("focus", actualizar); document.removeEventListener("visibilitychange", actualizar); };
  }, [perfil?.rol]);

  // Novedades en vivo: si el usuario está con la página abierta, la
  // notificación aparece en el momento, sin recargar.
  useEffect(() => {
    if (!perfil?.rol) return;
    const rol = perfil.rol.toUpperCase();
    if (!["ADMIN", "OFICINA", "COORDINACION"].includes(rol)) return;

    function agregarNovedad(n: any) {
      setNotificaciones((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        return [n, ...prev].slice(0, 8);
      });
      setNovedadEnVivo(n);
    }

    async function actualizarAsignaciones(eventoFinal?: any) {
      if (rol !== "OFICINA") return;
      const avisos = await cargarAvisosAsignacion(perfil.id);
      if (!avisos) return;
      setNotificaciones(prev => [...prev.filter(n => !n.id.startsWith("asignacion-vendedor-")), ...avisos]
        .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()).slice(0, 8));
      // No repetir avisos al cambiar otra solicitud o al recibir el mismo evento.
      avisosAsignacionConocidos.current = new Set(avisos.map(n => n.id));
      // El cartel sólo se anuncia tras el evento del guardado final. Los cambios
      // de asignación refrescan el listado, pero pueden estar pendientes de deshacer.
      if (eventoFinal && !eventosAsignacionAnunciados.current.has(String(eventoFinal.id))) {
        const id = `asignacion-vendedor-${eventoFinal.asignacion_id}-${eventoFinal.tecnico_id}-${String(eventoFinal.fecha).slice(0, 10)}`;
        const avisoFinal = avisos.find(n => n.id === id);
        if (avisoFinal) {
          eventosAsignacionAnunciados.current.add(String(eventoFinal.id));
          setNovedadEnVivo(avisoFinal);
        }
      }
    }

    const canal = supabase
      .channel("dashboard-novedades")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "solicitudes_fabrica" },
        async (payload) => {
          const t: any = payload.new;
          if (rol !== "ADMIN" || t.estado !== "PENDIENTE_APROBACION") return;

          let quien = "Oficina";
          if (t.creado_por) {
            const { data: creador } = await supabase
              .from("profiles")
              .select("nombre, apellido")
              .eq("id", t.creado_por)
              .maybeSingle();
            if (creador) quien = `${creador.nombre} ${creador.apellido || ""}`.trim();
          }

          agregarNovedad({
            id: `aprobacion-${t.id}`,
            titulo: "Cargaron un trabajo para aprobación",
            detalle: `Pedido #${t.numero_remito || t.id} - ${t.cliente_nombre || "Cliente"} (lo cargó ${quien})`,
            fecha: t.created_at || new Date().toISOString(),
            link: "/aprobacion-fabrica",
            icono: ShieldAlert,
            colorIcono: "bg-red-100 text-red-600",
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "solicitudes" },
        (payload) => {
          const s: any = payload.new;
          if (rol === "OFICINA" && s.creado_por === perfil.id) void actualizarAsignaciones();
          if (s.estado !== "PRESUPUESTADO" || !requierePrecio(s.tipo_visita)) return;
          if (rol === "OFICINA" && s.creado_por !== perfil.id) return;

          agregarNovedad({
            id: `presupuesto-${s.id}`,
            titulo: `Le asignaron precio al trabajo #${String(s.numero || s.id).padStart(5, "0")}`,
            detalle: `Cliente: ${s.cliente_nombre || "Cliente"} - Monto: $${(s.subtotal || s.precio || 0).toLocaleString()}`,
            fecha: s.updated_at || new Date().toISOString(),
            link: "/presupuestos",
            icono: DollarSign,
            colorIcono: "bg-emerald-100 text-emerald-600",
          });
        }
      )
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "solicitudes_fabrica" },
        (payload) => { if ((payload.new as any).creado_por === perfil.id) void actualizarAsignaciones(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "asignaciones" },
        () => { void actualizarAsignaciones(); })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "avisos_circuito", filter: `usuario_id=eq.${perfil.id}` },
        (payload) => {
          const n: any = payload.new;
          if (n.tipo === "asignacion_vendedor") void actualizarAsignaciones(n);
          if (n.tipo === "fabrica_lista") agregarNovedad({id:`fabrica-lista-${n.id}`, titulo:"Tu trabajo está listo para colocar", detalle:"Fábrica terminó el trabajo y lo pasó a Instalación.", fecha:n.created_at, link:`/ficha/remito/${n.solicitud_fabrica_id}`, icono:CheckCircle2, colorIcono:"bg-emerald-100 text-emerald-600"});
          if (n.tipo === "fabrica_aprobada") agregarNovedad({id:`fabrica-aprobada-${n.id}`, titulo:"Tu trabajo de fábrica fue aprobado", detalle:"El pedido fue aprobado y enviado a cortar.", fecha:n.created_at, link:`/ficha/remito/${n.solicitud_fabrica_id}`, icono:CheckCircle2, colorIcono:"bg-emerald-100 text-emerald-600"});
        })
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [perfil]);

  // El aviso en vivo se oculta solo a los 10 segundos
  useEffect(() => {
    if (!novedadEnVivo) return;
    const timer = setTimeout(() => setNovedadEnVivo(null), 10000);
    return () => clearTimeout(timer);
  }, [novedadEnVivo]);

  async function cargarAvisosAsignacion(usuarioId: string) {
    // RLS sigue vigente. No se amplía el acceso a clientes ni trabajos.
    const [visitas, pedidos, asignaciones, tecnicos] = await Promise.all([
      supabase.from("solicitudes").select("*").eq("creado_por", usuarioId).in("estado", ["ASIGNADO", "EN_PROCESO"]),
      supabase.from("solicitudes_fabrica").select("*").eq("creado_por", usuarioId).in("estado", ["ASIGNADO", "EN_PROCESO"]),
      supabase.from("asignaciones").select("*").eq("tipo", "TECNICO"),
      supabase.from("profiles").select("id,nombre,apellido").in("rol", ["TECNICO", "ENCARGADO"]),
    ]);
    if ([visitas, pedidos, asignaciones, tecnicos].some(r => r.error)) { setErrorAvisos(true); return null; }
    setErrorAvisos(false);
    return (asignaciones.data || []).flatMap(a => {
      const pedido = a.solicitud_fabrica_id ? pedidos.data?.find(p => p.id === a.solicitud_fabrica_id) : null;
      const visita = a.solicitud_id ? visitas.data?.find(v => v.id === a.solicitud_id) : null;
      const aviso = avisoAsignacionVendedor(a, visita, pedido, usuarioId, tecnicos.data?.find(t => t.id === a.usuario_id));
      return aviso ? [{...aviso, icono: Calendar, colorIcono: "bg-blue-100 text-blue-600"}] : [];
    }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

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
    // Consultar stock únicamente para Admin. Los demás roles no cargan estos datos.
    if (profile?.rol?.toUpperCase() === "ADMIN") {
      const { data: motores, error } = await supabase.from("stock_motores")
        .select("id, nombre, cantidad, minimo").order("nombre");
      setErrorStock(Boolean(error));
      setStockBajo((motores || []).filter((m) => m.cantidad <= m.minimo));
    } else {
      setStockBajo([]);
      setErrorStock(false);
    }

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

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
            titulo: `Pedido #${t.numero_remito || t.id} - ${t.cliente_nombre || "Cliente"}`,
            detalle: (t.estado || "").replaceAll("_", " "),
            link: "/fabrica",
          }))
      );

      setNotificaciones(
        trabajos.slice(0, 8).map((trabajo) => ({
          id: `fabrica-${trabajo.id}`,
          titulo: "Te asignaron un trabajo nuevo",
          detalle: `Pedido #${trabajo.numero_remito || trabajo.id} - ${
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
        .eq("usuario_id", user.id)
        .eq("fecha", hoy);

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

      const { data: visitasInstalacion } = solicitudFabricaIds.length
        ? await supabase.from("solicitudes").select("solicitud_fabrica_id, fecha_finalizacion").in("solicitud_fabrica_id", solicitudFabricaIds).not("fecha_finalizacion", "is", null)
        : { data: [] };
      const solicitudesTecnico: any[] = [
        ...(solBase || []).map(s => ({ ...s, origen: "visita" })),
        ...(solFab || []).filter(f => !(solBase || []).some(s => s.solicitud_fabrica_id === f.id)).map(s => ({ ...s, origen: "fabrica", fecha_finalizacion: (visitasInstalacion || []).find(v => v.solicitud_fabrica_id === s.id)?.fecha_finalizacion })),
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
        pendientes: solicitudesTecnico.filter((s: any) => !s.fecha_finalizacion && !["FINALIZADO", "ANULADO", "CANCELADO"].includes(s.estado)).length,
        finalizados: solicitudesTecnico.filter((s: any) => !!s.fecha_finalizacion || s.estado === "FINALIZADO").length,
      });

      // 2. ALERTAS PERSONALIZADAS PARA EL TÉCNICO
      const eventos: any[] = solicitudesTecnico
        .filter((s: any) => !s.fecha_finalizacion && !["FINALIZADO", "ANULADO", "CANCELADO"].includes(s.estado))
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

      const [{ data: solicitudes }, { data: trabajosFabrica }, { data: asignacionesHoy }] =
        await Promise.all([
          consultaSolicitudes,
          supabase
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
            .order("created_at", { ascending: false }),
          supabase
            .from("asignaciones")
            .select("solicitud_id, solicitud_fabrica_id")
            .eq("fecha", hoy),
        ]);

      const lista = solicitudes || [];
      const trabajos = trabajosFabrica || [];

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

      // ADMIN: aviso cuando cargan un trabajo nuevo para aprobación de fábrica
      if (profile?.rol?.toUpperCase() === "ADMIN") {
        const { data: pendientesAprobacion } = await supabase
          .from("solicitudes_fabrica")
          .select("*, creador:profiles!creado_por(nombre, apellido)")
          .eq("estado", "PENDIENTE_APROBACION")
          .order("created_at", { ascending: false })
          .limit(10);

        (pendientesAprobacion || []).forEach((t: any) => {
          const quien = t.creador
            ? `${t.creador.nombre} ${t.creador.apellido || ""}`.trim()
            : "Oficina";
          eventos.push({
            id: `aprobacion-${t.id}`,
            titulo: `Cargaron un trabajo para aprobación`,
            detalle: `Pedido #${t.numero_remito || t.id} - ${t.cliente_nombre || "Cliente"} (lo cargó ${quien})`,
            fecha: t.created_at,
            link: "/aprobacion-fabrica",
            icono: ShieldAlert,
            colorIcono: "bg-red-100 text-red-600",
          });
        });
      }

      lista.forEach((s) => {
        if (s.estado === "PRESUPUESTADO" && requierePrecio(s.tipo_visita)) {
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

      if (esOficina) {
        const aprobados = await supabase.from("avisos_circuito").select("id,solicitud_fabrica_id,created_at").eq("usuario_id", user.id).eq("tipo", "fabrica_aprobada").order("created_at", {ascending:false}).limit(8);
        if (!aprobados.error) {
          for (const aviso of aprobados.data || []) {
            eventos.push({ id: `fabrica-aprobada-${aviso.id}`, titulo: "Tu trabajo de fábrica fue aprobado",
              detalle: "El pedido fue aprobado y enviado a cortar.", fecha: aviso.created_at,
              link: `/ficha/remito/${aviso.solicitud_fabrica_id}`, icono: CheckCircle2, colorIcono: "bg-emerald-100 text-emerald-600" });
          }
        }
        const listos = await supabase.from("avisos_circuito").select("id,solicitud_fabrica_id,created_at").eq("usuario_id", user.id).eq("tipo", "fabrica_lista").order("created_at", {ascending:false}).limit(8);
        if (!listos.error) {
          for (const aviso of listos.data || []) eventos.push({id:`fabrica-lista-${aviso.id}`, titulo:"Tu trabajo está listo para colocar", detalle:"Fábrica terminó el trabajo y lo pasó a Instalación.", fecha:aviso.created_at, link:`/ficha/remito/${aviso.solicitud_fabrica_id}`, icono:CheckCircle2, colorIcono:"bg-emerald-100 text-emerald-600"});
        }
        const avisos = await cargarAvisosAsignacion(user.id);
        if (avisos) {
          avisosAsignacionConocidos.current = new Set(avisos.map(n => n.id));
          eventos.push(...avisos);
        }
      }
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
        <InicioVista
          perfil={perfil} stockBajo={stockBajo} errorStock={errorStock} paraHoy={paraHoy}
          metricasAdmin={metricasAdmin} metricasTecnico={metricasTecnico} metricasFabrica={metricasFabrica}
          metricasProduccion={metricasProduccion} notificaciones={notificaciones} errorAvisos={errorAvisos}
          novedadEnVivo={novedadEnVivo} setNovedadEnVivo={setNovedadEnVivo} cargando={cargando}
        />
      </main>
    </div>
  );
}
