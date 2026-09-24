"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import { X, Lock, Wrench, User } from "lucide-react";

export default function SeccionPreciosAdminPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(true);

  const [modalTrabajo, setModalTrabajo] = useState<any | null>(null);
  const [precio, setPrecio] = useState<string>("");
  const [adicionalesPrecio, setAdicionalesPrecio] = useState<string>("");
  const [guardando, setGuardando] = useState<boolean>(false);

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

    if (profile?.rol !== "ADMIN") {
      window.location.href = "/dashboard";
      return;
    }

    setPerfil(profile);

    // Traemos TODOS los finalizados sin doble filtrado de texto.
    const { data: solData, error: errSol } = await supabase
      .from("solicitudes")
      .select("*, creador:profiles!creado_por(nombre, apellido)")
      .in("estado", ["PENDIENTE_PRECIO", "FINALIZADO"])
      .order("id", { ascending: false });

    if (errSol) {
      alert("Error al cargar solicitudes pendientes: " + errSol.message);
      setCargando(false);
      return;
    }

    const solicitudesLista = (solData || []).filter((solicitud) => {
      const tipo = String(solicitud.tipo_visita || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

      return (
        tipo.includes("presupuesto") ||
        tipo.includes("mantenimiento") ||
        tipo.includes("instalacion") ||
        tipo.includes("urgencia")
      );
    });

    if (solicitudesLista.length > 0) {
      const ids = solicitudesLista.map((s) => s.id);
      
      const { data: asignaciones, error: errAsig } = await supabase
        .from("asignaciones")
        .select("solicitud_id, tecnico:profiles!usuario_id(nombre, apellido)")
        .in("solicitud_id", ids.length > 0 ? ids : [0]);
        
      if (errAsig) console.error("Error al traer técnicos: ", errAsig);

      const listaConInfo = solicitudesLista.map((s) => {
        const asig = asignaciones?.find((a) => a.solicitud_id === s.id);
        const tecObj = asig?.tecnico as any;
        const creadorInfo = s.creador as any;
        return {
          ...s,
          tecnico_real: tecObj ? `${tecObj.nombre} ${tecObj.apellido || ""}`.trim() : "Sin técnico",
          usuario_creador: creadorInfo ? `${creadorInfo.nombre} ${creadorInfo.apellido || ""}`.trim() : "Oficina",
        };
      });

      setPresupuestos(listaConInfo);
    } else {
      setPresupuestos([]);
    }

    setCargando(false);
  }

  function abrirModalAdmin(item: any) {
    setModalTrabajo(item);
    setPrecio(item.subtotal || item.precio || "");
    setAdicionalesPrecio(item.adicionales_visita || item.adicionales_precio || "");
  }

  async function asignarPrecio() {
    if (!modalTrabajo) return;
    setGuardando(true);

    const valorNumerico = parseFloat(precio) || 0;

    const { error } = await supabase
      .from("solicitudes")
      .update({
        subtotal: valorNumerico,
        precio: valorNumerico,
        adicionales_visita: adicionalesPrecio || null,
        adicionales_precio: adicionalesPrecio || null,
        estado: "PRESUPUESTADO", 
      })
      .eq("id", modalTrabajo.id);

    if (error) {
      alert("Error al guardar el precio: " + error.message);
    } else {
      setModalTrabajo(null);
      await cargarDatos();
    }

    setGuardando(false);
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar nombre={perfil?.nombre || "Admin"} apellido={perfil?.apellido || ""} rol="ADMIN" />
      <main className="ml-0 md:ml-64 flex-1 p-6 md:p-10">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Lock className="text-amber-500" size={22} />
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Asignación de Precios (Admin)</h1>
        </div>
        <p className="text-center text-xs text-slate-500 mb-8">
          Trabajos terminados por técnicos que requieren tu tarifación. Al guardar, se enviarán al Inbox de la Oficina.
        </p>

        {cargando ? (
          <p className="text-center text-sm text-slate-400">Cargando trabajos...</p>
        ) : presupuestos.length === 0 ? (
          <div className="bg-white p-12 rounded-xl text-center max-w-md mx-auto shadow-sm border border-slate-100">
            <p className="text-sm text-slate-500">No hay presupuestos pendientes para tarifar.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 max-w-5xl mx-auto">
            {presupuestos.map((p) => (
              <div
                key={p.id}
                onClick={() => abrirModalAdmin(p)}
                className="cursor-pointer rounded-xl bg-white p-6 shadow-sm border border-slate-200 transition hover:shadow-md hover:border-amber-400"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">Remito #{p.numero || p.id}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800">Pendiente de Tarifar</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">{p.cliente_nombre || "Cliente sin nombre"}</h3>
                <p className="text-xs font-semibold text-slate-500 mt-1 uppercase">{p.direccion} {p.localidad ? `- ${p.localidad}` : ""}</p>
                <p className="text-xs text-slate-600 mt-2">👷 <strong>Técnico:</strong> {p.tecnico_real}</p>
                <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500 border-t border-slate-100 pt-2">
                  <User size={13} className="text-slate-400" />
                  <span>Cargado por:</span>
                  <span className="font-semibold text-slate-800">{p.usuario_creador}</span>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs font-bold text-slate-700">
                  <span className="text-amber-700 font-medium">Por tarifar</span>
                  <span className="text-amber-600 font-semibold">Cargar precio →</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL ADMIN */}
        {modalTrabajo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
            <div className="relative w-full max-w-3xl rounded-3xl bg-white overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto">
              <button onClick={() => setModalTrabajo(null)} className="absolute top-4 right-4 z-10 bg-white/80 p-1.5 rounded-full text-slate-700 hover:bg-white transition">
                <X size={20} />
              </button>
              <div className="p-8 mt-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">Remito #{modalTrabajo.numero || modalTrabajo.id}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-md font-semibold bg-amber-100 text-amber-800">Pendiente de Tarifar</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{modalTrabajo.cliente_nombre || "Cliente"}</h1>
                <p className="text-base font-medium text-slate-600 mt-1">{modalTrabajo.direccion} {modalTrabajo.localidad ? `- ${modalTrabajo.localidad}` : ""}</p>
                <div className="mt-4 space-y-2 text-xs text-slate-700 leading-relaxed">
                  <p><strong>Cargado por:</strong> {modalTrabajo.usuario_creador}</p>
                  <p><strong>Tipo de visita:</strong> {modalTrabajo.tipo_visita || "No especificado"}</p>
                  <p><strong>Solicitud de oficina:</strong> {modalTrabajo.detalles || modalTrabajo.observaciones || "Sin especificaciones."}</p>
                  <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 my-2">
                    <p className="font-bold text-amber-900 flex items-center gap-1.5 mb-1"><Wrench size={14} /> Trabajo realizado por el técnico:</p>
                    <p className="text-amber-950 font-medium whitespace-pre-wrap">{modalTrabajo.trabajo_realizado || modalTrabajo.detalles_tecnico || "Trabajo finalizado."}</p>
                  </div>
                  <p><strong>Técnico responsable:</strong> {modalTrabajo.tecnico_real}</p>
                  <p><strong>Fecha finalizado:</strong> {modalTrabajo.fecha_finalizacion ? new Date(modalTrabajo.fecha_finalizacion).toLocaleDateString("es-AR") : "-"}</p>
                </div>
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Precio Asignado ($)</label>
                    <input type="number" placeholder="Ej: 45000" value={precio} onChange={(e) => setPrecio(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-amber-500 bg-white" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase mb-1">Adicionales del precio</label>
                    <input type="text" placeholder="Ej: Incluye tornillos" value={adicionalesPrecio} onChange={(e) => setAdicionalesPrecio(e.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-amber-500 bg-white" />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={asignarPrecio} disabled={guardando || !precio} className="rounded-xl bg-amber-500 px-8 py-3 text-xs font-bold text-white hover:bg-amber-600 transition disabled:opacity-50 shadow-sm">
                    {guardando ? "Asignando..." : "Guardar y Enviar a Oficina"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
