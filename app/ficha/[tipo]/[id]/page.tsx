import { createClient } from "@/lib/supabase/server";
import { textoFranja } from "@/lib/franjas";
import { redirect, notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Factory,
  FileText,
  MapPin,
  Phone,
  User,
  Wrench,
} from "lucide-react";

// ============================================================
// FICHA ENCADENADA: una ficha por trabajo, con todo el circuito
// visita -> precio -> aceptacion/sena -> aprobacion -> fabrica ->
// instalacion -> remito/garantia -> factura y saldo.
// Cliente y domicilio se cargan una sola vez y se heredan.
// ============================================================

type Etapa = {
  nombre: string;
  estado: "hecha" | "actual" | "pendiente";
  fecha?: string | null;
  responsable?: string | null;
  detalle?: string | null;
};

function fechaLinda(fecha: string | null | undefined) {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function plata(valor: number | null | undefined) {
  if (valor === null || valor === undefined) return "-";
  return `$ ${Number(valor).toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export default async function FichaPage({
  params,
}: {
  params: Promise<{ tipo: string; id: string }>;
}) {
  const { tipo, id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (tipo !== "visita" && tipo !== "remito") notFound();

  const numId = Number(id);
  if (Number.isNaN(numId)) notFound();

  // =========================
  // RESOLVER LA CADENA
  // =========================
  let solicitud: any = null;
  let remito: any = null;

  if (tipo === "remito") {
    const { data } = await supabase
      .from("solicitudes_fabrica")
      .select("*")
      .eq("id", numId)
      .single();
    if (!data) notFound();
    remito = data;

    const { data: sol } = await supabase
      .from("solicitudes")
      .select("*")
      .eq("solicitud_fabrica_id", numId)
      .maybeSingle();
    solicitud = sol;
  } else {
    const { data } = await supabase
      .from("solicitudes")
      .select("*")
      .eq("id", numId)
      .single();
    if (!data) notFound();
    solicitud = data;

    if (solicitud.solicitud_fabrica_id) {
      const { data: rem } = await supabase
        .from("solicitudes_fabrica")
        .select("*")
        .eq("id", solicitud.solicitud_fabrica_id)
        .maybeSingle();
      remito = rem;
    }
  }

  const base = remito || solicitud;
  const clienteId = base.cliente_id || solicitud?.cliente_id || null;

  let cliente: any = null;
  if (clienteId) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", clienteId)
      .maybeSingle();
    cliente = data;
  }

  // =========================
  // LINEA DE TIEMPO
  // =========================
  const orEventos: string[] = [];
  if (solicitud) orEventos.push(`solicitud_id.eq.${solicitud.id}`);
  if (remito) orEventos.push(`solicitud_fabrica_id.eq.${remito.id}`);

  let eventos: any[] = [];
  if (orEventos.length) {
    const { data } = await supabase
      .from("trabajo_eventos")
      .select("*")
      .or(orEventos.join(","))
      .order("created_at", { ascending: true });
    eventos = data || [];
  }

  // =========================
  // VENTAS Y PAGOS (plata)
  // =========================
  const orVentas: string[] = [];
  if (solicitud) orVentas.push(`solicitud_id.eq.${solicitud.id}`);
  if (remito) orVentas.push(`solicitud_fabrica_id.eq.${remito.id}`);

  let ventas: any[] = [];
  if (orVentas.length) {
    const { data } = await supabase
      .from("ventas")
      .select("*")
      .or(orVentas.join(","))
      .order("created_at", { ascending: true });
    ventas = data || [];
  }

  let pagos: any[] = [];
  if (ventas.length) {
    const { data } = await supabase
      .from("pagos")
      .select("*")
      .in(
        "venta_id",
        ventas.map((v) => v.id)
      )
      .order("fecha", { ascending: true });
    pagos = data || [];
  }

  const totalVenta = ventas.reduce((a, v) => a + Number(v.total || 0), 0);
  const totalPagado = pagos.reduce((a, p) => a + Number(p.monto || 0), 0);
  const saldo = totalVenta - totalPagado;

  // =========================
  // RESPONSABLES (nombres)
  // =========================
  const idsResp = new Set<string>();
  eventos.forEach((e) => e.responsable && idsResp.add(e.responsable));
  if (base.creado_por) idsResp.add(base.creado_por);

  const nombres: Record<string, string> = {};
  if (idsResp.size) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .in("id", [...idsResp]);
    (profs || []).forEach((p) => {
      nombres[p.id] = `${p.nombre} ${p.apellido || ""}`.trim();
    });
  }

  // =========================
  // ASIGNACIONES (instalacion)
  // =========================
  const orAsig: string[] = [];
  if (solicitud) orAsig.push(`solicitud_id.eq.${solicitud.id}`);
  if (remito) orAsig.push(`solicitud_fabrica_id.eq.${remito.id}`);

  let asignaciones: any[] = [];
  if (orAsig.length) {
    const { data } = await supabase
      .from("asignaciones")
      .select("*")
      .or(orAsig.join(","))
      .order("fecha", { ascending: true });
    asignaciones = data || [];
  }

  const idsTecnicos = [...new Set(asignaciones.map((a) => a.usuario_id).filter(Boolean))];
  if (idsTecnicos.length) {
    const { data: tecs } = await supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .in("id", idsTecnicos);
    (tecs || []).forEach((p) => {
      nombres[p.id] = `${p.nombre} ${p.apellido || ""}`.trim();
    });
  }

  const ultimaAsignacion = asignaciones[asignaciones.length - 1];

  // =========================
  // BUSCADOR DE EVENTOS
  // =========================
  function buscarEvento(...palabras: string[]) {
    const encontrados = eventos.filter((e) =>
      palabras.some((p) => (e.etapa || "").toLowerCase().includes(p.toLowerCase()))
    );
    return encontrados[encontrados.length - 1] || null;
  }

  // =========================
  // ETAPAS DEL CIRCUITO
  // =========================
  const etapas: Etapa[] = [];
  const estadoFab: string | null = remito?.estado || null;
  const estadoSol: string | null = solicitud?.estado || null;

  const estadosPostAprobacion = [
    "ENVIADO_A_CORTAR",
    "EN_CORTE",
    "EN_FABRICACION",
    "EN_FABRICA",
    "FALTANTES",
    "LISTO_PARA_COLOCAR",
    "PENDIENTE_COORDINACION",
    "COORDINACION",
    "ENVIADO_COORDINACION",
    "ASIGNADO",
    "FINALIZADO",
  ];
  const estadosEnFabrica = [
    "ENVIADO_A_CORTAR",
    "EN_CORTE",
    "EN_FABRICACION",
    "EN_FABRICA",
    "FALTANTES",
  ];
  const estadosPostFabrica = [
    "LISTO_PARA_COLOCAR",
    "PENDIENTE_COORDINACION",
    "COORDINACION",
    "ENVIADO_COORDINACION",
    "ASIGNADO",
    "FINALIZADO",
  ];

  const finalizado =
    estadoFab === "FINALIZADO" || estadoSol === "FINALIZADO";

  const evPrecio = buscarEvento("precio asignado");
  const evAprobacion = buscarEvento("enviado a cortar");
  const evFabrica = buscarEvento("en fabricacion", "en fabrica", "en corte");
  const evFinalizado = buscarEvento("trabajo finalizado", "finalizado");
  const evPago = buscarEvento("pago registrado", "venta registrada");
  const evAsignacion = buscarEvento("asignado a tecnico");

  if (remito) {
    // CIRCUITO CORTINA NUEVA (remito de fabrica)
    etapas.push({
      nombre: "Trabajo cargado",
      estado: "hecha",
      fecha: remito.created_at,
      responsable: remito.creado_por ? nombres[remito.creado_por] : null,
      detalle: `Remito #${remito.numero_remito || remito.id}`,
    });

    etapas.push({
      nombre: "Precio / presupuesto",
      estado: remito.total_pesos || evPrecio ? "hecha" : "pendiente",
      fecha: evPrecio?.created_at || null,
      responsable: evPrecio?.responsable ? nombres[evPrecio.responsable] : null,
      detalle: remito.total_pesos ? `Total: ${plata(remito.total_pesos)}` : null,
    });

    etapas.push({
      nombre: "Aceptacion y sena",
      estado:
        Number(remito.sena_pesos || 0) > 0 || pagos.length > 0
          ? "hecha"
          : "pendiente",
      fecha: evPago?.created_at || null,
      responsable: evPago?.responsable ? nombres[evPago.responsable] : null,
      detalle:
        Number(remito.sena_pesos || 0) > 0
          ? `Sena: ${plata(remito.sena_pesos)}`
          : pagos.length
          ? `${pagos.length} pago(s) registrados`
          : null,
    });

    etapas.push({
      nombre: "Aprobacion de fabrica",
      estado:
        estadoFab && estadoFab !== "PENDIENTE_APROBACION" && estadoFab !== "ANULADO"
          ? "hecha"
          : "pendiente",
      fecha: evAprobacion?.created_at || null,
      responsable: evAprobacion?.responsable ? nombres[evAprobacion.responsable] : null,
    });

    etapas.push({
      nombre: "Fabricacion",
      estado: estadoFab && estadosPostFabrica.includes(estadoFab) ? "hecha" : "pendiente",
      fecha: evFabrica?.created_at || null,
      detalle:
        estadoFab && estadosEnFabrica.includes(estadoFab)
          ? `Ahora: ${estadoFab.replaceAll("_", " ")}`
          : null,
    });

    etapas.push({
      nombre: "Instalacion",
      estado: finalizado ? "hecha" : "pendiente",
      fecha: evFinalizado?.created_at || ultimaAsignacion?.fecha || null,
      responsable: ultimaAsignacion?.usuario_id
        ? nombres[ultimaAsignacion.usuario_id]
        : null,
      detalle: ultimaAsignacion?.fecha
        ? `Fecha pactada: ${fechaLinda(ultimaAsignacion.fecha)}`
        : null,
    });

    etapas.push({
      nombre: "Remito y garantia",
      estado: finalizado ? "hecha" : "pendiente",
      fecha: evFinalizado?.created_at || null,
      detalle: "El remito firmado sirve de garantia",
    });
  } else {
    // CIRCUITO REPARACION / VISITA
    etapas.push({
      nombre: "Visita cargada",
      estado: "hecha",
      fecha: solicitud.created_at,
      responsable: solicitud.creado_por ? nombres[solicitud.creado_por] : null,
      detalle: solicitud.tipo_visita || "Visita",
    });

    etapas.push({
      nombre: "Visita realizada",
      estado:
        estadoSol === "FINALIZADO" ||
        estadoSol === "PENDIENTE_PRECIO" ||
        estadoSol === "PRESUPUESTADO"
          ? "hecha"
          : "pendiente",
      fecha: estadoSol !== "PENDIENTE" && estadoSol !== "ASIGNADO" ? evFinalizado?.created_at || null : null,
      responsable: ultimaAsignacion?.usuario_id
        ? nombres[ultimaAsignacion.usuario_id]
        : null,
      detalle: solicitud.trabajo_realizado ? "Trabajo cargado por el tecnico" : null,
    });

    etapas.push({
      nombre: "Precio / presupuesto",
      estado: estadoSol === "PRESUPUESTADO" ? "hecha" : "pendiente",
      fecha: evPrecio?.created_at || solicitud.presupuesto_fecha || null,
      responsable: evPrecio?.responsable ? nombres[evPrecio.responsable] : null,
      detalle:
        estadoSol === "PRESUPUESTADO"
          ? `Monto: ${plata(solicitud.subtotal || solicitud.precio)}`
          : null,
    });

    etapas.push({
      nombre: "Aceptacion y sena",
      estado: ventas.length > 0 || pagos.length > 0 ? "hecha" : "pendiente",
      fecha: evPago?.created_at || null,
      responsable: evPago?.responsable ? nombres[evPago.responsable] : null,
    });

    etapas.push({
      nombre: "Trabajo terminado",
      estado: estadoSol === "FINALIZADO" ? "hecha" : "pendiente",
      fecha: evFinalizado?.created_at || null,
    });
  }

  // Etapa de plata, siempre al final
  const hayPlata = totalVenta > 0 || Number(base.saldo_restante || 0) > 0 || Number(base.total_pesos || 0) > 0;
  etapas.push({
    nombre: "Factura y saldo",
    estado: totalVenta > 0 && saldo <= 0 ? "hecha" : "pendiente",
    detalle:
      totalVenta > 0
        ? saldo > 0
          ? `Saldo: ${plata(saldo)}`
          : "Saldado"
        : Number(base.saldo_restante || 0) > 0
        ? `Saldo: ${plata(base.saldo_restante)}`
        : hayPlata
        ? null
        : "Sin venta registrada todavia",
  });

  // Marcar la etapa actual (la primera pendiente)
  const idxActual = etapas.findIndex((e) => e.estado === "pendiente");
  if (idxActual >= 0) etapas[idxActual].estado = "actual";

  // Presupuesto con vigencia (reparaciones)
  const vigenciaDias = solicitud?.presupuesto_vigencia_dias || 15;
  const presupuestoFecha = solicitud?.presupuesto_fecha || evPrecio?.created_at || null;
  let presupuestoVence: string | null = null;
  if (presupuestoFecha && estadoSol === "PRESUPUESTADO") {
    const v = new Date(presupuestoFecha);
    v.setDate(v.getDate() + vigenciaDias);
    presupuestoVence = fechaLinda(v.toISOString());
  }

  const estadoActualTexto = (estadoFab || estadoSol || "").replaceAll("_", " ");
  const numeroMostrar = remito
    ? `Remito #${remito.numero_remito || remito.id}`
    : `Visita #${solicitud.numero || solicitud.id}`;

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 pt-20 md:p-10">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            <ArrowLeft size={16} />
            Volver al panel
          </Link>

          {/* ENCABEZADO */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Ficha del trabajo
                </p>
                <h1 className="mt-1 text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                  {numeroMostrar}
                </h1>
              </div>
              <span className="rounded-full bg-blue-100 px-4 py-1.5 text-sm font-semibold text-blue-800">
                {estadoActualTexto || "En curso"}
              </span>
            </div>
          </div>

          {/* DATOS DEL TRABAJO: se cargan una sola vez */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-slate-900">
              Datos del trabajo
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <User size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Cliente</p>
                  {clienteId ? (
                    <Link
                      href={`/clientes/${clienteId}`}
                      className="text-sm font-semibold text-blue-700 hover:underline"
                    >
                      {cliente?.nombre || base.cliente_nombre || "-"}
                    </Link>
                  ) : (
                    <p className="text-sm font-semibold text-slate-800">
                      {cliente?.nombre || base.cliente_nombre || "-"}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Phone size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Telefono</p>
                  <p className="text-sm text-slate-700">
                    {cliente?.telefono || base.cliente_telefono || "-"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Direccion</p>
                  <p className="text-sm text-slate-700">
                    {base.direccion || "-"}
                    {base.localidad ? ` - ${base.localidad}` : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <ClipboardList size={16} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400">Tipo</p>
                  <p className="text-sm text-slate-700">
                    {base.tipo_visita || (remito ? "Cortina nueva" : "Visita")}
                  </p>
                </div>
              </div>

              {(base.horario_desde || base.horario_hasta) && (
                <div className="flex items-start gap-3">
                  <Wrench size={16} className="mt-0.5 shrink-0 text-slate-400" />
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400">Horario pactado</p>
                    <p className="text-sm text-slate-700">
                      {textoFranja(base.horario_desde, base.horario_hasta)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {base.observaciones && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">
                  Observaciones
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {base.observaciones}
                </p>
              </div>
            )}

            {solicitud?.medidas && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase text-slate-400">Medidas</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                  {solicitud.medidas}
                </p>
              </div>
            )}
          </div>

          {/* CIRCUITO (STEPPER) */}
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-base font-bold text-slate-900">
              Circuito del trabajo
            </h2>
            <ol className="relative ml-3 border-l-2 border-slate-200">
              {etapas.map((etapa, i) => (
                <li key={i} className="mb-5 ml-6 last:mb-0">
                  <span
                    className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full ${
                      etapa.estado === "hecha"
                        ? "bg-emerald-100 text-emerald-600"
                        : etapa.estado === "actual"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    {etapa.estado === "hecha" ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-current" />
                    )}
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p
                      className={`text-sm font-bold ${
                        etapa.estado === "pendiente"
                          ? "text-slate-400"
                          : "text-slate-900"
                      }`}
                    >
                      {etapa.nombre}
                      {etapa.estado === "actual" && (
                        <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700">
                          Etapa actual
                        </span>
                      )}
                    </p>
                    {etapa.fecha && (
                      <p className="text-xs text-slate-400">{fechaLinda(etapa.fecha)}</p>
                    )}
                  </div>
                  {(etapa.responsable || etapa.detalle) && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[etapa.responsable, etapa.detalle].filter(Boolean).join(" - ")}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* PRESUPUESTO CON VIGENCIA */}
          {estadoSol === "PRESUPUESTADO" && (
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                <h2 className="text-base font-bold text-emerald-900">Presupuesto</h2>
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-900">
                {plata(solicitud.subtotal || solicitud.precio)}
              </p>
              <p className="mt-1 text-xs text-emerald-700">
                Emitido el {fechaLinda(presupuestoFecha) || "-"}
                {presupuestoVence ? ` - valido por ${vigenciaDias} dias (vence el ${presupuestoVence})` : ""}
              </p>
            </div>
          )}

          {/* PLATA */}
          {(ventas.length > 0 || hayPlata) && (
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-base font-bold text-slate-900">Plata</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {totalVenta > 0 ? plata(totalVenta) : plata(base.total_pesos)}
                  </p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="text-xs text-emerald-700">Pagado</p>
                  <p className="mt-1 text-xl font-bold text-emerald-700">
                    {plata(totalPagado > 0 ? totalPagado : base.sena_pesos)}
                  </p>
                </div>
                <div className="rounded-xl bg-amber-50 p-4">
                  <p className="text-xs text-amber-700">Saldo</p>
                  <p className="mt-1 text-xl font-bold text-amber-700">
                    {totalVenta > 0 ? plata(saldo) : plata(base.saldo_restante)}
                  </p>
                </div>
              </div>

              {pagos.length > 0 && (
                <div className="mt-4 divide-y divide-slate-100">
                  {pagos.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-2">
                      <p className="text-sm text-slate-700">
                        {plata(p.monto)}
                        {p.medio ? ` - ${p.medio}` : ""}
                        {p.facturado ? " (facturado)" : ""}
                      </p>
                      <p className="text-xs text-slate-400">{fechaLinda(p.fecha)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACCESOS */}
          <div className="mb-6 flex flex-wrap gap-3">
            {remito && (
              <Link
                href={`/remitos/${remito.id}/pdf`}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                <FileText size={14} />
                Ver remito PDF
              </Link>
            )}
            {remito && ["ADMIN"].includes(perfil?.rol || "") && (
              <Link
                href={`/aprobacion-fabrica/${remito.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-2.5 text-xs font-semibold text-amber-700 border border-amber-100 hover:bg-amber-100"
              >
                <Factory size={14} />
                Aprobacion de fabrica
              </Link>
            )}
            {clienteId && (
              <Link
                href={`/clientes/${clienteId}`}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-semibold text-blue-700 border border-blue-100 hover:bg-blue-100"
              >
                <User size={14} />
                Ficha del cliente
              </Link>
            )}
          </div>

          {/* LINEA DE TIEMPO */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-base font-bold text-slate-900">
              Historial del trabajo
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              Quien hizo cada paso y cuando
            </p>
            {eventos.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                Todavia no hay movimientos registrados.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {[...eventos].reverse().map((e) => (
                  <div key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{e.etapa}</p>
                      {e.detalle && (
                        <p className="text-xs text-slate-500">{e.detalle}</p>
                      )}
                      {e.responsable && nombres[e.responsable] && (
                        <p className="text-xs text-slate-400">
                          por {nombres[e.responsable]}
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-slate-400">
                      {fechaLinda(e.created_at)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
                  }
