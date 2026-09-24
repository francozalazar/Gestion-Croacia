"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import { Info, Download, X, Wrench, User } from "lucide-react";

export default function InboxPresupuestoOficinaPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalPrincipal, setModalPrincipal] = useState<any | null>(null);

  useEffect(() => {
    cargarDatos();
  }, []);

  async function cargarDatos() {
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

    // CORRECCIÓN AQUÍ: cambiamos "updated_at" por "id"
    let query = supabase
      .from("solicitudes")
      .select("*, creador:profiles!creado_por(nombre, apellido)")
      .in("estado", ["PENDIENTE_PRECIO", "PRESUPUESTADO"])
      .order("id", { ascending: false });

    // Filtramos para que la oficina solo vea lo suyo
    if (profile?.rol === "OFICINA") {
      query = query.eq("creado_por", user.id);
    }

    const { data: solData, error: errSol } = await query;

    if (errSol) {
      alert("Error al cargar Inbox de presupuestos: " + errSol.message);
      console.error(errSol);
      setCargando(false);
      return;
    }

    const lista = solData || [];

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

  function descargarRemitoPDF(remito: any) {
    if (!remito?.id) return;
    window.open(`/finalizados/${remito.id}/pdf`, "_blank");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar nombre={perfil?.nombre || "Usuario"} apellido={perfil?.apellido || ""} rol={perfil?.rol || "OFICINA"} />

      <main className="ml-0 md:ml-64 flex-1 p-6 pt-20 md:p-10">
        <h1 className="text-3xl font-bold text-center text-slate-900 mb-2">Inbox de presupuesto</h1>

        <div className="mx-auto max-w-4xl mb-8 flex items-center gap-2 bg-slate-100 p-3.5 rounded-xl text-xs text-slate-500 border border-slate-200">
          <Info size={16} className="text-blue-500 shrink-0" />
          <p>Acá puedes consultar tus trabajos tarifados y finalizados listos para gestionar. Presiona en un trabajo para ver detalles.</p>
        </div>

        {cargando ? (
          <p className="text-center text-sm text-slate-400">Cargando presupuestos...</p>
        ) : presupuestos.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center max-w-md mx-auto shadow-xs border border-slate-100">
            <p className="text-sm text-slate-500">No tenés trabajos en tu inbox por el momento.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-5xl mx-auto">
            {presupuestos.map((p) => {
              const tiposQueRequierenPrecio = ["presupuesto", "mantenimiento", "instalacion", "urgencia"];
              const tipo = (p.tipo_visita || "")
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .trim();
              const requierePrecio = tiposQueRequierenPrecio.includes(tipo);
              const monto = p.subtotal || p.precio || 0;

              return (
                <div
                  key={p.id}
                  onClick={() => setModalPrincipal(p)}
                  className="cursor-pointer rounded-2xl bg-white p-6 shadow-xs border border-slate-200 transition hover:shadow-md hover:border-emerald-400"
                >
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
                      {requierePrecio ? `Precio: $${monto.toLocaleString()}` : "No requiere tarifa"}
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

              <h1 className="text-2xl font-bold text-slate-900">{modalPrincipal.cliente_nombre || "Cliente"}</h1>
              <p className="text-base font-semibold text-slate-600 mt-1">
                {modalPrincipal.direccion} {modalPrincipal.localidad ? `- ${modalPrincipal.localidad}` : ""}
              </p>

              <div className="mt-5 space-y-3 text-xs text-slate-700 bg-slate-50 p-4 rounded-2xl border border-slate-100">
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

              <div className="mt-6 flex items-center justify-between p-4 bg-slate-100 rounded-2xl">
                <span className="text-xs uppercase font-bold text-slate-500">
                  {["presupuesto", "mantenimiento", "instalacion", "urgencia"].includes(
                    (modalPrincipal.tipo_visita || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
                  ) ? "Precio asignado" : "Trabajo sin tarifa"}
                </span>
                <span className="text-xl font-bold text-emerald-700">
                  $ {(modalPrincipal.subtotal || modalPrincipal.precio || 0).toLocaleString()}
                </span>
              </div>

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
