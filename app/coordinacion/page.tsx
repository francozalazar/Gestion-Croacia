"use client";

import { asignarPasos } from "@/lib/pasosCircuito";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import { compararCoordinacion } from "@/lib/coordinacion";
import CoordinacionVista, { type ConfirmarCoordinacion } from "@/components/CoordinacionVista";


export default function CoordinacionPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [solicitudes, setSolicitudes] = useState<any[]>([]);
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

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
    // 1-4. PERFIL + TÉCNICOS + SOLICITUDES (NORMALES Y FÁBRICA)
    // Son consultas independientes: las lanzamos en paralelo
    // para que la pantalla cargue más rápido.
    // =========================================================

    const [
      { data: profile, error: errorProfile },
      { data: tecs, error: errorTecnicos },
      { data: solBase, error: errorSolBase },
      { data: solFabrica, error: errorSolFabrica },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, nombre, apellido, rol")
        .eq("id", user.id)
        .single(),
      supabase
        .from("profiles")
        .select("id, nombre, apellido")
        .in("rol", ["TECNICO", "ENCARGADO"])
        .eq("activo", true)
        .order("nombre"),
      supabase
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
        ]),
      supabase
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
        ]),
    ]);

    if (errorProfile) {
      console.error("Error obteniendo perfil:", errorProfile);
    }

    setPerfil(profile);

    if (errorTecnicos) {
      console.error("Error obteniendo técnicos:", errorTecnicos);
    }

    setTecnicos(tecs || []);

    if (errorSolBase) {
      console.error("Error obteniendo solicitudes:", errorSolBase);
    }

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
      // Badge verde de la tarjeta: los trabajos que pasaron por fábrica se
      // identifican como Instalación (los tipos de visita no cambian).
      tipo_origen: "Instalación",
      usuario_creador: item.creador
        ? `${item.creador.nombre} ${item.creador.apellido || ""}`.trim()
        : "Sin usuario",
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
          !s.solicitud_fabrica_id &&
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

    // Fecha historica solo cuando el ultimo evento propio prueba que sigue
    // en Coordinacion. No usar fecha de carga ni eventos de la visita hija.
    const idsPedidos = mapeadasFab.filter(s => !s.coordinacion_desde).map(s => s.id);
    const idsVisitas = baseFiltradas.filter(s => !s.coordinacion_desde).map(s => s.id);
    const [eventosPedidos, eventosVisitas] = await Promise.all([
      idsPedidos.length ? supabase.from("trabajo_eventos").select("solicitud_fabrica_id, etapa, created_at, id").in("solicitud_fabrica_id", idsPedidos).is("solicitud_id", null).order("created_at", { ascending: false }).order("id", { ascending: false }) : Promise.resolve({ data: [] }),
      idsVisitas.length ? supabase.from("trabajo_eventos").select("solicitud_id, etapa, created_at, id").in("solicitud_id", idsVisitas).order("created_at", { ascending: false }).order("id", { ascending: false }) : Promise.resolve({ data: [] }),
    ]);
    const entradaComprobada = (eventos: any[], campo: string, id: number) => {
      const ultimo = eventos.find(e => e[campo] === id);
      return ultimo && ["Pendiente de coordinacion", "En coordinacion", "PENDIENTE"].includes(ultimo.etapa) ? ultimo.created_at : null;
    };
    mapeadasFab.forEach(s => { if (!s.coordinacion_desde) s.coordinacion_desde = entradaComprobada(eventosPedidos.data || [], "solicitud_fabrica_id", s.id); });
    baseFiltradas.forEach(s => { if (!s.coordinacion_desde) s.coordinacion_desde = entradaComprobada(eventosVisitas.data || [], "solicitud_id", s.id); });

    // =========================================================
    // 7. UNIR TODO
    // =========================================================

    setSolicitudes([
      ...mapeadasFab,
      ...baseFiltradas,
    ].sort(compararCoordinacion));

    setCargando(false);
  }

  // Asignación real (Admin): escribe con el cliente del usuario.
  async function confirmarAsignacion(d: ConfirmarCoordinacion): Promise<boolean> {
    const r = await asignarPasos(supabase, {
      id: d.solicitud.id,
      esFabrica: !!d.solicitud.es_fabrica,
      tecnicoId: d.tecnicoId,
      fecha: d.fecha,
      prioridad: d.prioridad,
      datosActualizacion: {
        estado: "ASIGNADO",
        fecha: d.fecha,
        horario_desde: d.hDesde,
        horario_hasta: d.hHasta,
      },
    });
    if (!r.ok) {
      if (r.etapa === "asignacion") {
        if (r.error?.code === "23505") {
          alert(
            `El técnico ya tiene otro trabajo con prioridad ${d.prioridad} para ese día.`
          );
        } else {
          alert("Error al asignar el trabajo: " + r.error?.message);
        }
      } else {
        alert(
          "Error al actualizar el trabajo: " +
            r.error?.message +
            (r.deshecho
              ? ". No se guardó la asignación, probá de nuevo."
              : ". La asignación quedó guardada: volvé a tocar Asignar para completar.")
        );
      }
      return false;
    }
    await cargarDatos();
    return true;
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

      <main className="ml-0 flex-1 p-6 pt-20 md:ml-64 md:p-10">

        <CoordinacionVista
          solicitudes={solicitudes}
          tecnicos={tecnicos}
          cargando={cargando}
          puedeAsignar={perfil?.rol === "ADMIN"}
          subtitulo={
            perfil?.rol === "ADMIN"
              ? "Asigna fecha y técnico responsable para derivar las órdenes a la hoja de ruta de los camiones."
              : "Consulta de órdenes pendientes de coordinación por parte de administración."
          }
          onConfirmar={confirmarAsignacion}
        />
      </main>

    </div>
  );
}
