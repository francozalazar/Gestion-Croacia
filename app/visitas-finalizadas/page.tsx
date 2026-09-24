"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/cliente";
import Sidebar from "@/components/Sidebar";
import { CheckCircle2, User, Search, MapPin, FileText, X, ArrowRight, Download, DollarSign } from "lucide-react";

export default function VisitasFinalizadasPage() {
  const supabase = createClient();

  const [perfil, setPerfil] = useState<any>(null);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(false);
  const [modalDetalle, setModalDetalle] = useState<any | null>(null);

  useEffect(() => {
    cargarPerfil();
  }, []);

  async function cargarPerfil() {
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
  }

  // Trae absolutamente todas las visitas finalizadas de la empresa
  async function buscarVisitas(terminoBusqueda: string) {
    const texto = terminoBusqueda.trim();
    if (!texto) {
      setVisitas([]);
      return;
    }

    setCargando(true);

    const { data: solData } = await supabase
      .from("solicitudes")
      .select("*, creador:profiles!usuario_id(nombre, apellido)")
      .eq("estado", "FINALIZADO")
      .order("id", { ascending: false });

    const lista = solData || [];

    if (lista.length > 0) {
      const ids = lista.map((s) => s.id);
      const { data: asignaciones } = await supabase
        .from("asignaciones")
        .select("solicitud_id, profiles(nombre, apellido)")
        .in("solicitud_id", ids);

      const mapeadas = lista.map((s) => {
        const asig = asignaciones?.find((a) => a.solicitud_id === s.id);
        const tec = asig?.profiles as any;
        const creadorInfo = s.creador as any;
        return {
          ...s,
          tecnico_real: tec ? `${tec.nombre} ${tec.apellido || ""}`.trim() : "Sin técnico",
          usuario_creador: creadorInfo ? `${creadorInfo.nombre} ${creadorInfo.apellido || ""}`.trim() : "Oficina",
        };
      });

      const termino = texto.toLowerCase();
      const filtradas = mapeadas.filter((v) => {
        const cliente = (v.cliente_nombre || "").toLowerCase();
        const direccion = (v.direccion || "").toLowerCase();
        const localidad = (v.localidad || "").toLowerCase();
        const numRemito = String(v.numero || v.id || "").toLowerCase();
        const fecha = (v.fecha || "").toLowerCase();

        return (
          cliente.includes(termino) ||
          direccion.includes(termino) ||
          localidad.includes(termino) ||
          numRemito.includes(termino) ||
          fecha.includes(termino)
        );
      });

      setVisitas(filtradas);
    } else {
      setVisitas([]);
    }

    setCargando(false);
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const valor = e.target.value;
    setBusqueda(valor);
    buscarVisitas(valor);
  }

  // Conexión directa con la API route oficial del PDF de finalizados
  function descargarRemitoPDF(remito: any) {
    if (!remito?.id) return;
    window.open(`/finalizados/${remito.id}/pdf`, "_blank");
  }

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 pt-20 md:p-10">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
          Visitas Finalizadas
        </h1>
        <p className="text-xs text-slate-500 mb-6">
          Búsqueda global del historial de visitas concluidas por los técnicos. Escribe para comenzar.
        </p>

        {/* BARRA DE BÚSQUEDA */}
        <div className="mb-8 relative max-w-4xl">
          <input
            type="text"
            placeholder="Buscar por cliente, dirección, fecha (YYYY-MM-DD) o número de remito..."
            value={busqueda}
            onChange={handleSearchChange}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pl-4 pr-10 text-sm outline-none shadow-sm focus:border-blue-500"
          />
          <Search className="absolute right-3 top-3.5 text-slate-400" size={18} />
        </div>

        {/* CONTENIDO SEGÚN BÚSQUEDA */}
        {!busqueda.trim() ? (
          <div className="bg-white p-12 rounded-xl text-center max-w-md mx-auto shadow-sm border border-slate-100">
            <Search size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">Realiza una búsqueda para ver el listado de visitas finalizadas.</p>
          </div>
        ) : cargando ? (
          <p className="text-center text-sm text-slate-400 py-10">Buscando visitas...</p>
        ) : visitas.length === 0 ? (
          <div className="bg-white p-12 rounded-xl text-center max-w-md mx-auto shadow-sm border border-slate-100">
            <CheckCircle2 size={40} className="mx-auto text-amber-400 mb-3" />
            <p className="text-sm text-slate-600 font-medium">No se encontraron visitas finalizadas con esos datos.</p>
          </div>
        ) : (
          <div className="max-w-5xl space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Resultados encontrados ({visitas.length})
            </p>

            {visitas.map((v) => (
              <div
                key={v.id}
                onClick={() => setModalDetalle(v)}
                className="cursor-pointer rounded-xl bg-white p-4 px-6 shadow-sm border border-slate-200 transition hover:border-emerald-400 hover:shadow-md flex items-center justify-between gap-4 flex-wrap sm:flex-nowrap"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 shrink-0">
                    #{v.numero || v.id}
                  </span>
                  
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-slate-900 truncate">{v.cliente_nombre || "Cliente sin nombre"}</h3>
                    <p className="text-xs text-slate-500 truncate uppercase">
                      {v.direccion} {v.localidad ? `- ${v.localidad}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6 text-xs text-slate-600 shrink-0">
                  <div className="hidden md:block text-right">
                    <p className="text-slate-400">Técnico:</p>
                    <p className="font-semibold text-slate-800">{v.tecnico_real}</p>
                  </div>

                  <span className="px-2.5 py-1 rounded-md font-semibold bg-emerald-100 text-emerald-800">
                    Finalizado
                  </span>

                  <ArrowRight size={16} className="text-slate-400" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL DE DETALLES COMPLETO CON DESCARGA DE PDF OFICIAL */}
        {modalDetalle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-3xl rounded-3xl bg-white p-8 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setModalDetalle(null)}
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  Remito #{modalDetalle.numero || modalDetalle.id}
                </span>
                <span className="text-xs px-3 py-1 rounded-md font-semibold bg-emerald-100 text-emerald-800">
                  Finalizado
                </span>
              </div>

              <h2 className="text-2xl font-bold text-slate-900">
                {modalDetalle.cliente_nombre || "Cliente sin nombre"}
              </h2>

              <p className="text-sm font-medium text-slate-600 mt-1 flex items-center gap-1.5">
                <MapPin size={16} className="text-slate-400" />
                {modalDetalle.direccion} {modalDetalle.localidad ? `- ${modalDetalle.localidad}` : ""}
              </p>

              {/* CONTENEDOR DE INFORMACIÓN COMPLETA */}
              <div className="mt-6 space-y-4 text-xs text-slate-700">
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <p className="text-slate-400 font-bold uppercase tracking-wider mb-2">Información general</p>
                  <p><strong>Cargado por:</strong> {modalDetalle.usuario_creador}</p>
                  <p><strong>Técnico responsable:</strong> {modalDetalle.tecnico_real}</p>
                  <p><strong>Fecha de visita:</strong> {modalDetalle.fecha || "No especificada"}</p>
                  <p><strong>Tipo de visita:</strong> {modalDetalle.tipo_visita || "No especificado"}</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-1">
                  <p className="text-slate-400 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                    <FileText size={14} /> Observaciones originales
                  </p>
                  <p className="text-slate-800">{modalDetalle.observaciones || "Sin observaciones."}</p>
                </div>

                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 space-y-1">
                  <p className="text-emerald-900 font-bold uppercase tracking-wider mb-1">
                    Trabajo realizado por el técnico
                  </p>
                  <p className="text-emerald-950 font-medium whitespace-pre-wrap">
                    {modalDetalle.trabajo_realizado || modalDetalle.detalles_tecnico || "Trabajo finalizado correctamente."}
                  </p>
                </div>

                {/* INFORMACIÓN ECONÓMICA Y DE PAGOS */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2">
                  <p className="text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <DollarSign size={14} /> Datos comerciales y pagos
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4 pt-1">
                    <div>
                      <p className="text-slate-500">Precio / Subtotal:</p>
                      <p className="text-sm font-bold text-slate-900">
                        ${(modalDetalle.subtotal || modalDetalle.precio || 0).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-slate-500">Saldo restante:</p>
                      <p className="text-sm font-bold text-emerald-700">
                        {modalDetalle.saldo_restante !== null && modalDetalle.saldo_restante !== undefined
                          ? `$${modalDetalle.saldo_restante.toLocaleString()}`
                          : "$0"}
                      </p>
                    </div>
                  </div>

                  {modalDetalle.medio_pago && (
                    <p className="pt-2"><strong>Medio de pago:</strong> {modalDetalle.medio_pago}</p>
                  )}
                  {modalDetalle.aclaracion_pago && (
                    <p><strong>Aclaración de pago:</strong> {modalDetalle.aclaracion_pago}</p>
                  )}
                </div>

              </div>

              {/* BOTONES DE ACCIÓN (DESCARGAR PDF OFICIAL Y CERRAR) */}
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => descargarRemitoPDF(modalDetalle)}
                  className="rounded-xl bg-amber-500 text-white px-5 py-2.5 text-xs font-semibold hover:bg-amber-600 transition flex items-center gap-2 shadow-sm"
                >
                  <Download size={14} /> Descargar PDF
                </button>

                <button
                  onClick={() => setModalDetalle(null)}
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
