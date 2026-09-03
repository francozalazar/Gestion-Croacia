"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";
import { Clock, BellRing, ArrowLeft, CheckCircle2 } from "lucide-react";

const tiposVisita = [
  "Cortar e instalar",
];

export default function SolicitudFabricaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");

  const [fecha, setFecha] = useState("");
  const [franjaHoraria, setFranjaHoraria] = useState("");
  const [preferencia, setPreferencia] = useState("");
  const [tipoVisita, setTipoVisita] = useState("");

  const [observaciones, setObservaciones] = useState("");

  const [total, setTotal] = useState("");
  const [saldo, setSaldo] = useState("");

  const [senaPorcentaje, setSenaPorcentaje] = useState("");
  const [senaPesos, setSenaPesos] = useState("");

  const [medioPago, setMedioPago] = useState("");
  
  // NUEVO: Estado para la aclaración de pagos o facturación
  const [aclaracionPago, setAclaracionPago] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [exito, setExito] = useState(false);

  useEffect(() => {
    const totalNum = parseFloat(total) || 0;
    const porcNum = parseFloat(senaPorcentaje) || 0;
    let pesosNum = parseFloat(senaPesos) || 0;

    if (porcNum > 0 && totalNum > 0) {
      pesosNum = (totalNum * porcNum) / 100;
      setSenaPesos(pesosNum.toString());
    }

    if (totalNum > 0) {
      const saldoCalculado = totalNum - pesosNum;
      setSaldo(saldoCalculado >= 0 ? saldoCalculado.toString() : "0");
    } else {
      setSaldo("");
    }
  }, [total, senaPorcentaje, senaPesos]);

  async function guardarSolicitud() {
    setMensaje("");

    if (!cliente.trim()) {
      setMensaje("Ingresá el nombre del cliente.");
      return;
    }

    if (!direccion.trim()) {
      setMensaje("Ingresá la dirección.");
      return;
    }

    setGuardando(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMensaje("No se pudo identificar al usuario.");
      setGuardando(false);
      return;
    }

    let hDesde = null;
    let hHasta = null;
    if (franjaHoraria === "mañana") {
      hDesde = "08:00";
      hHasta = "12:00";
    } else if (franjaHoraria === "tarde") {
      hDesde = "13:00";
      hHasta = "17:00";
    } else if (franjaHoraria === "completo") {
      hDesde = "08:00";
      hHasta = "17:00";
    }

    const observacionesFinales = preferencia.trim()
      ? `[Aviso: ${preferencia.trim()}]\n${observaciones.trim()}`
      : observaciones.trim() || null;

    const { data, error } = await supabase
      .from("solicitudes_fabrica")
      .insert({
        cliente_nombre: cliente.trim(),
        cliente_telefono: null,

        direccion: direccion.trim(),
        localidad: localidad.trim() || null,

        fecha: fecha || null,
        horario_desde: hDesde,
        horario_hasta: hHasta,
        tipo_visita: tipoVisita.trim() || null,

        observaciones: observacionesFinales,

        total_pesos: total ? Number(total) : null,
        saldo_restante: saldo ? Number(saldo) : null,

        sena_porcentaje: senaPorcentaje
          ? Number(senaPorcentaje)
          : null,

        sena_pesos: senaPesos
          ? Number(senaPesos)
          : null,

        medio_pago: medioPago || null,
        
        // Guardamos la aclaración de pagos (asegurate de tener esta columna en tu tabla 'solicitudes_fabrica', o podés concatenarla a observaciones si preferís)
        aclaracion_pago: aclaracionPago.trim() || null,

        estado: "PENDIENTE_APROBACION",
        creado_por: user.id,
      })
      .select("id, numero_remito")
      .single();

    if (error) {
      console.error(error);
      setMensaje(error.message);
      setGuardando(false);
      return;
    }

    setExito(true);
    setMensaje(
      `¡Remito Nº ${data.numero_remito} cargado correctamente! Redirigiendo...`
    );

    setGuardando(false);

    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  const inputClassName = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl">

        {/* Botón para volver atrás */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Volver al inicio
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Nuevo remito para fábrica
          </h1>

          <p className="mt-2 text-slate-600">
            Cargá todos los datos del cliente y de la cortina.
          </p>
        </div>

        {mensaje && (
          <div className={`mb-6 flex items-center gap-3 rounded-xl border p-4 text-sm font-medium shadow-sm ${
            exito ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}>
            {exito && <CheckCircle2 size={20} className="text-emerald-600 flex-shrink-0" />}
            {mensaje}
          </div>
        )}

        <div className="space-y-6">

          {/* DATOS DEL CLIENTE */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Datos del cliente
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Cliente *
                </label>
                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre y apellido"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Dirección *
                </label>
                <input
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Dirección"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Localidad
                </label>
                <input
                  type="text"
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  placeholder="Localidad"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>
            </div>
          </section>

          {/* DATOS DE LA SOLICITUD */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Datos de la solicitud
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputClassName}
                  disabled={exito}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Tipo de visita</label>
                <select
                  value={tipoVisita}
                  onChange={(e) => setTipoVisita(e.target.value)}
                  className={inputClassName}
                  disabled={exito}
                >
                  <option value="">Seleccionar...</option>
                  {tiposVisita.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <Clock size={16} /> Franja Horaria
                </label>
                <select
                  value={franjaHoraria}
                  onChange={(e) => setFranjaHoraria(e.target.value)}
                  className={inputClassName}
                  disabled={exito}
                >
                  <option value="">Coordinar con cliente...</option>
                  <option value="mañana">Por la mañana (08:00 a 12:00)</option>
                  <option value="tarde">Por la tarde (13:00 a 17:00)</option>
                  <option value="completo">Día completo (08:00 a 17:00)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 flex items-center gap-2 text-sm font-medium">
                  <BellRing size={16} /> Aviso / Preferencia
                </label>
                <input
                  type="text"
                  value={preferencia}
                  onChange={(e) => setPreferencia(e.target.value)}
                  placeholder="Ej: Avisar media hora antes..."
                  className={inputClassName}
                  disabled={exito}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">
                Observaciones / datos de la cortina
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                placeholder="Cargá acá toda la información de la cortina..."
                rows={7}
                className={`${inputClassName} resize-none`}
                disabled={exito}
              />
            </div>
          </section>

          {/* DATOS COMERCIALES */}
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Datos comerciales
            </h2>

           

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Total en pesos</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={total}
                  onChange={(e) => setTotal(e.target.value)}
                  placeholder="Ej: 850000"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Saldo restante (Automático)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={saldo}
                  readOnly
                  placeholder="Se calcula solo..."
                  className="w-full rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-slate-700 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">Seña (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={senaPorcentaje}
                  onChange={(e) => setSenaPorcentaje(e.target.value)}
                  placeholder="Ej: 50"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Seña ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={senaPesos}
                  onChange={(e) => setSenaPesos(e.target.value)}
                  placeholder="Ej: 425000"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">Medio de pago</label>
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className={inputClassName}
                disabled={exito}
              >
                <option value="">Seleccionar medio de pago</option>
                <option value="Efectivo">Efectivo</option>
                <option value="Santander">Santander</option>
                <option value="Mercado Pago">Mercado Pago</option>
                <option value="Cuenta corriente">Cuenta corriente</option>
              </select>
            </div>

            {/* NUEVO: Espacio para aclaración del pago o facturación */}
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">
                Aclaración de pago / Facturación
              </label>
              <input
                type="text"
                value={aclaracionPago}
                onChange={(e) => setAclaracionPago(e.target.value)}
                placeholder="Ej: Le pagaron a Juanjo / Factura A N° 0001-..."
                className={inputClassName}
                disabled={exito}
              />
            </div>
          </section>

          {/* BOTON */}
          <button
            type="button"
            onClick={guardarSolicitud}
            disabled={guardando || exito}
            className="w-full rounded-xl bg-slate-900 px-5 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando ? "Guardando remito..." : exito ? "¡Remito guardado con éxito!" : "Crear remito y enviar a aprobación"}
          </button>

        </div>
      </div>
    </main>
  );
}