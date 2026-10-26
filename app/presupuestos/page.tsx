"use client";

import FotoTrabajo from "@/components/FotoTrabajo";
import PortadaFotoTrabajo from "@/components/PortadaFotoTrabajo";
import { requierePrecio } from "@/lib/tipoVisita";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import { Info, Download, X, Wrench, User, Archive, ArchiveRestore } from "lucide-react";

export default function InboxPresupuestoOficinaPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalPrincipal, setModalPrincipal] = useState<any | null>(null);

  const [verArchivados, setVerArchivados] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState("");

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
    setCargando(true);
    setErrorArchivo("");

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

    // Presupuestos es una bandeja personal para todos los roles, incluido ADMIN.
    const query = supabase
      .from("solicitudes")
      .select("*, creador:profiles!creado_por(nombre, apellido)")
      .eq("creado_por", user.id)
      .in("estado", ["PENDIENTE_PRECIO", "PRESUPUESTADO"])
      .order("id", { ascending: false });

    const { data: solData, error: errSol } = await query;

    if (errSol) {
      alert("Error al cargar Inbox de presupuestos: " + errSol.message);
      console.error(errSol);
      setErrorArchivo("No se pudieron cargar los presupuestos. Reintentá recargando la página.");
      setCargando(false);
      return;
    }

    const { data: archivos, error: errArchivo } = await supabase
      .from("presupuestos_archivados").select("solicitud_id").eq("vendedor_id", user.id);
    if (errArchivo) {
      setErrorArchivo("No se pudo consultar el archivo. Reintentá recargando la página.");
      setCargando(false);
      return;
    }
    setErrorArchivo("");
    const archivados = new Set((archivos || []).map((a) => a.solicitud_id));
    // Defensa adicional: listas, conteos y detalles parten solo de registros propios.
    const lista = (solData || []).filter((s) => s.creado_por === user.id)
      .map((s) => ({ ...s, archivado: archivados.has(s.id) }));

    if (lista.length > 0) {
      const ids = lista.map((s) => s.id);
      
      const { data: asignaciones, error: errAsig } = await supabase
        .from("asignaciones")
        .select("solicitud_id, tecnico:profiles!usuario_id(nombre, apellido)")
        .in("solicitud_id", ids);

      if (errAsig) {
        console.error("Error al traer asignaciones en Inbox:", errAsig);
      }

      const mapeadas = lista.map((s) => {
        const asig = asignaciones?.find((a) => a.solicitud_id === s.id);
        const tecObj = asig?.tecnico as any;
        const creadorInfo = s.creador as any;
        return {
          ...s,
          estadoTexto:
            s.estado === "PENDIENTE_PRECIO"
              ? "Pendiente de tarifar"
              : "Tarifado",
          tecnico_real: tecObj
            ? `${tecObj.nombre} ${tecObj.apellido || ""}`.trim()
            : "Sin técnico",
          usuario_creador: creadorInfo
            ? `${creadorInfo.nombre} ${creadorInfo.apellido || ""}`.trim()
            : "Oficina",
        };
      });

      setPresupuestos(mapeadas);
    } else {
      setPresupuestos([]);
    }

    setCargando(false);
  }

  async function cambiarArchivo(presupuesto: any) {
    if (guardando || presupuesto.creado_por !== perfil?.id || !["OFICINA", "ADMIN"].includes(perfil?.rol)) return;
    const restaurar = !!presupuesto.archivado;
    if (!window.confirm(restaurar
      ? "¿Volver a mostrar este presupuesto en Activos?"
      : "¿Quitar este presupuesto de la lista activa? Se oculta de Activos, pero no se borra ni cambia el trabajo. Podés restaurarlo desde Archivados.")) return;
    setGuardando(true);
    try {
      const resultado = restaurar
        ? await supabase.from("presupuestos_archivados").delete().eq("solicitud_id", presupuesto.id).eq("vendedor_id", perfil.id).select("solicitud_id")
        : await supabase.from("presupuestos_archivados").insert({ solicitud_id: presupuesto.id, vendedor_id: perfil.id }).select("solicitud_id");
      if (resultado.error || !resultado.data?.length) {
        alert("No se pudo guardar el cambio. Recargá la página y reintentá.");
        return;
      }
      setModalPrincipal(null);
      await cargarDatos();
    } finally {
      setGuardando(false);
    }
  }

  const visibles = presupuestos.filter((p) => !!p.archivado === verArchivados);

  function descargarRemitoPDF(remito: any) {
    if (!remito?.id) return;
    window.open(`/finalizados/${remito.id}/pdf`, "_blank");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar nombre={perfil?.nombre || "Usuario"} apellido={perfil?.apellido || ""} rol={perfil?.rol || "OFICINA"} />

      <main className="ml-0 md:ml-64 flex-1 p-6 pt-20 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Inbox de presupuesto</h1>

        <div className="mx-auto max-w-4xl mb-8 flex items-center gap-2 bg-slate-100 p-3.5 rounded-xl text-xs text-slate-500 border border-slate-200">
          <Info size={16} className="text-blue-500 shrink-0" />
          <p>Consultá tus presupuestos activos o archivados. Archivar solo los saca de esta lista: no borra el trabajo ni cambia su historial, ventas o estadísticas.</p>
        </div>

        <div className="flex gap-2 mb-6" role="group" aria-label="Ver presupuestos">
          {[false, true].map((archivo) => (
            <button key={String(archivo)} onClick={() => { setVerArchivados(archivo); setModalPrincipal(null); }}
              aria-pressed={verArchivados === archivo}
              className={`rounded-md px-4 py-2 text-sm font-semibold border ${verArchivados === archivo ? "bg-blue-700 text-white border-blue-700" : "bg-white text-slate-700 border-slate-300"}`}>
              {archivo ? "Archivados" : "Activos"} ({presupuestos.filter((p) => !!p.archivado === archivo).length})
            </button>
          ))}
        </div>
        {errorArchivo ? <p role="alert" className="text-red-700 mb-4">{errorArchivo}</p> : null}
        {cargando ? (
          <p className="text-center text-sm text-slate-400">Cargando presupuestos...</p>
        ) : errorArchivo ? null : visibles.length === 0 ? (
          <div className="bg-white p-12 rounded-xl text-center max-w-md mx-auto shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500">{verArchivados ? "No tenés presupuestos archivados." : "No tenés presupuestos activos."}</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-5xl mx-auto">
            {visibles.map((p) => {
              const requierePrecioTipo = requierePrecio(p.tipo_visita);
              const monto = p.subtotal || p.precio || 0;

              return (
                <div
                  key={p.id}
                  onClick={() => setModalPrincipal(p)}
                  className="cursor-pointer rounded-xl bg-white p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:border-emerald-400"
                >
                  <PortadaFotoTrabajo solicitudId={p.id} />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      Remito #{p.numero || p.id}
                    </span>
                    <span
                      className={
                        p.estado === "PENDIENTE_PRECIO"
                          ? "rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800"
                          : "rounded-md bg-green-100 px-2 py-1 text-xs font-semibold text-green-800"
                      }
                    >
                      {p.estadoTexto}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900">{p.cliente_nombre || "Cliente sin nombre"}</h3>
                  <p className="text-xs font-semibold text-slate-500 mt-1 uppercase">
                    {p.direccion} {p.localidad ? `- ${p.localidad}` : ""}
                  </p>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">
                    <strong>Trabajo:</strong> {p.trabajo_realizado || p.detalles_tecnico || p.observaciones || "Completado"}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 border-t border-slate-100 pt-2">
                    <User size={13} className="text-slate-400" />
                    <span>Cargado por:</span>
                    <span className="font-semibold text-slate-800">{p.usuario_creador}</span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-700">
                    <span className="text-slate-700 font-bold text-sm">
                      {requierePrecioTipo ? `Precio: $${monto.toLocaleString()}` : "No requiere tarifa"}
                    </span>
                    <span className="text-blue-600">Ver detalles →</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODAL DETALLE PARA OFICINA */}
        {modalPrincipal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-2xl rounded-3xl bg-white p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setModalPrincipal(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{modalPrincipal.cliente_nombre || "Cliente"}</h1>
              <p className="text-base font-semibold text-slate-600 mt-1">
                {modalPrincipal.direccion} {modalPrincipal.localidad ? `- ${modalPrincipal.localidad}` : ""}
              </p>

              <div className="mt-5 space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-100">
                <p><strong>Cargado por:</strong> {modalPrincipal.usuario_creador}</p>
                <p><strong>Tipo de visita:</strong> {modalPrincipal.tipo_visita || "No especificado"}</p>
                <p><strong>Solicitud de origen:</strong> {modalPrincipal.detalles || modalPrincipal.observaciones || "Sin observaciones"}</p>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="font-bold text-emerald-900 flex items-center gap-1.5 mb-1">
                    <Wrench size={14} /> Trabajo realizado por el técnico:
                  </p>
                  <p className="text-emerald-950 font-medium whitespace-pre-wrap">
                    {modalPrincipal.trabajo_realizado || modalPrincipal.detalles_tecnico || "Trabajo finalizado."}
                  </p>
                </div>

                <p><strong>Técnico responsable:</strong> {modalPrincipal.tecnico_real}</p>
                <p><strong>Adicionales del precio:</strong> {modalPrincipal.adicionales_visita || modalPrincipal.adicionales_precio || "Sin adicionales"}</p>
              </div>

              <FotoTrabajo solicitudId={modalPrincipal.id} />

              <div className="mt-6 flex items-center justify-between p-4 bg-slate-100 rounded-xl">
                <span className="text-xs uppercase font-bold text-slate-500">
                  {requierePrecio(modalPrincipal.tipo_visita) ? "Precio asignado" : "Trabajo sin tarifa"}
                </span>
                <span className="text-xl font-bold text-emerald-700">
                  $ {(modalPrincipal.subtotal || modalPrincipal.precio || 0).toLocaleString()}
                </span>
              </div>

              {modalPrincipal.creado_por === perfil?.id && ["OFICINA", "ADMIN"].includes(perfil?.rol) && (
                <button disabled={guardando} onClick={() => cambiarArchivo(modalPrincipal)}
                  className="mt-6 flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  {modalPrincipal.archivado ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                  {guardando ? "Guardando..." : modalPrincipal.archivado ? "Restaurar presupuesto" : "Quitar de presupuestos"}
                </button>
              )}
              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => descargarRemitoPDF(modalPrincipal)}
                  className="rounded-xl bg-amber-500 text-white px-5 py-2.5 text-xs font-medium hover:bg-amber-600 transition flex items-center gap-2"
                >
                  <Download size={14} /> Descargar PDF
                </button>

                <button
                  onClick={() => setModalPrincipal(null)}
                  className="rounded-xl bg-slate-200 px-6 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-300 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
