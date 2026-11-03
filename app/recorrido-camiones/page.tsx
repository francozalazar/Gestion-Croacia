"use client";

import { quitarOAnularPasos } from "@/lib/pasosCircuito";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import RecorridoVista from "@/components/RecorridoVista";

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

    const rol = (profile?.rol || "").toUpperCase();

    // Fábrica no usa esta vista: su pantalla es Trabajos a realizar.
    if (rol === "FABRICA") {
      window.location.href = "/fabrica";
      return;
    }

    // Cualquier otro rol fuera de los esperados vuelve al inicio.
    if (!["ADMIN", "OFICINA", "COORDINACION", "TECNICO"].includes(rol)) {
      window.location.href = "/dashboard";
      return;
    }

    // El técnico solo consulta SU recorrido: no se carga la lista de
    // camiones ni se muestran trabajos de otros.
    if (rol === "TECNICO") {
      setTecnicoSeleccionado(user.id);
      ejecutarBusqueda(user.id, fecha);
      return;
    }

    // 2. Cargar TODOS los técnicos / camiones del sistema
    const { data } = await supabase
      .from("profiles")
      .select("id, nombre, apellido, rol")
      .in("rol", ["TECNICO", "ENCARGADO"])
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


  async function buscarRecorrido() {
    if (!tecnicoSeleccionado) return;
    ejecutarBusqueda(tecnicoSeleccionado, fecha);
  }

  async function ejecutarBusqueda(tecId: string, fechaFiltro: string) {
    // Un técnico solo puede ver su propio recorrido.
    if (perfil?.rol?.toUpperCase() === "TECNICO" && tecId !== perfil.id) {
      return;
    }
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

  async function cambiarPrioridad(trabajoModal: any, prioridadNumerica: number | null, cerrar: () => void) {
    if (!trabajoModal) return;

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

    cerrar();
    await ejecutarBusqueda(tecnicoSeleccionado, fecha);
  }

  // ACCIÓN 1: Quita la asignación del técnico y lo devuelve a COORDINACIÓN
  async function removerTecnicoYFecha(trabajoModal: any, cerrar: () => void) {
    if (!trabajoModal) return;

    const r = await quitarOAnularPasos(supabase, {
      id: trabajoModal.id,
      esFabrica: !!trabajoModal._esFabrica,
      tecnicoId: tecnicoSeleccionado,
      fecha,
      accion: "QUITAR",
    });

    if (!r.ok) {
      if (r.etapa === "asignacion") {
        alert(
          r.sinPermiso
            ? "No se quitó la asignación. Solo un administrador puede quitar asignaciones."
            : "Error quitando asignación: " + r.error?.message
        );
        return;
      }
      alert(
        "Error actualizando trabajo: " +
          r.error?.message +
          (r.deshecho
            ? ". No se quitó la asignación, probá de nuevo."
            : ". La asignación se quitó pero el estado no cambió: avisá a administración.")
      );
      await ejecutarBusqueda(tecnicoSeleccionado, fecha);
      return;
    }

    cerrar();
    await ejecutarBusqueda(tecnicoSeleccionado, fecha);
  }

  // ACCIÓN 2: Anula completamente la visita
  async function anularVisita(trabajoModal: any, cerrar: () => void) {
    if (!trabajoModal) return;

    if (!confirm("¿Estás seguro de anular esta visita? El remito quedará cancelado.")) return;

    const r = await quitarOAnularPasos(supabase, {
      id: trabajoModal.id,
      esFabrica: !!trabajoModal._esFabrica,
      tecnicoId: tecnicoSeleccionado,
      fecha,
      accion: "ANULAR",
    });

    if (!r.ok) {
      if (r.etapa === "asignacion") {
        alert(
          r.sinPermiso
            ? "No se anuló la visita porque no se pudo quitar su asignación. Solo un administrador puede quitar asignaciones."
            : "Error anulando asignación: " + r.error?.message
        );
        return;
      }
      alert(
        "Error anulando trabajo: " +
          r.error?.message +
          (r.deshecho
            ? ". No se anuló nada, probá de nuevo."
            : ". La asignación se quitó pero el trabajo no se anuló: avisá a administración.")
      );
      await ejecutarBusqueda(tecnicoSeleccionado, fecha);
      return;
    }

    cerrar();
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
        <RecorridoVista
          esTecnico={perfil?.rol?.toUpperCase() === "TECNICO"}
          esAdmin={perfil?.rol?.toUpperCase() === "ADMIN"}
          tecnicos={tecnicos}
          tecnicoSeleccionado={tecnicoSeleccionado}
          setTecnicoSeleccionado={setTecnicoSeleccionado}
          fecha={fecha}
          setFecha={setFecha}
          onBuscar={buscarRecorrido}
          trabajos={trabajos}
          cargando={cargando}
          puedeCambiarPrioridad={perfil?.rol?.toUpperCase() !== "TECNICO"}
          onCambiarPrioridad={cambiarPrioridad}
          onQuitar={removerTecnicoYFecha}
          onAnular={anularVisita}
        />
      </main>
    </div>
  );
}
