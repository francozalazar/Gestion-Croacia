"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/cliente";
import ClienteAutocomplete from "@/components/ClienteAutocomplete";
import { resolverClienteYDireccion } from "@/lib/clientes";
import { useRouter } from "next/navigation";
import { Clock, BellRing, ArrowLeft, CheckCircle2 } from "lucide-react";
import Sidebar from "@/components/Sidebar";

const tiposVisita = ["Cortar e instalar"];

const tiposVenta = [
  { value: "CORTINA", label: "Cortina completa" },
  { value: "PORTON_LAMA", label: "Portón lama" },
  { value: "REPARACION", label: "Reparación" },
];

export default function SolicitudFabricaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");
  const [provincia, setProvincia] = useState("");

  const [fecha, setFecha] = useState("");
  const [franjaHoraria, setFranjaHoraria] = useState("");
  const [preferencia, setPreferencia] = useState("");
  const [tipoVisita, setTipoVisita] = useState("");

  const [observaciones, setObservaciones] = useState("");

  const [total, setTotal] = useState("");
  const [saldo, setSaldo] = useState("");

  const [senaPorcentaje, setSenaPorcentaje] = useState("");
  const [senaPesos, setSenaPesos] = useState("");
  const [ultimaEdicionSena, setUltimaEdicionSena] = useState<
    "porcentaje" | "pesos" | null
  >(null);

  const [medioPago, setMedioPago] = useState("");
  const [aclaracionPago, setAclaracionPago] = useState("");

  const [renglones, setRenglones] = useState<
    { tipo: string; cantidad: string }[]
  >([{ tipo: "", cantidad: "1" }]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [exito, setExito] = useState(false);
  // Pasos ya hechos de un pedido a medio guardar (para reintentar sin duplicar)
  const progreso = useRef<{
    id: string;
    numero: number | string | null;
    clienteId: string | number | null;
    direccionId: string | number | null;
    itemsOk: boolean;
    ventaId: string | null;
    pagoOk: boolean;
  } | null>(null);
  const [perfil, setPerfil] = useState<any>(null);

  useEffect(() => {
    // Si quedó un pedido a medio guardar (se recargó la página), avisar y permitir completarlo sin crear otro.
    try {
      const raw = localStorage.getItem("croacia_pedido_pendiente");
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.id) {
          progreso.current = {
            id: p.id,
            numero: p.numero ?? null,
            clienteId: p.clienteId ?? null,
            direccionId: p.direccionId ?? null,
            itemsOk: !!p.itemsOk,
            ventaId: p.ventaId ?? null,
            pagoOk: !!p.pagoOk,
          };
          setMensaje(
            `Hay un pedido a medio guardar: el remito Nº ${p.numero} quedó cargado pero faltan pasos (qué se vende, venta o seña). Volvé a completar los mismos datos y tocá guardar: se completa ese pedido, no se crea otro.`
          );
        }
      }
    } catch {
      // sin almacenamiento local
    }
  }, []);

  useEffect(() => {
    async function cargarPerfil() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("nombre, apellido, rol")
        .eq("id", user.id)
        .single();

      setPerfil(data);
    }

    cargarPerfil();
  }, []);

  useEffect(() => {
    const totalNum = parseFloat(total) || 0;
    const porcNum = parseFloat(senaPorcentaje) || 0;
    let pesosNum = parseFloat(senaPesos) || 0;

    if (totalNum > 0) {
      // Lo que se editó último manda: el otro campo se calcula solo.
      if (ultimaEdicionSena === "pesos") {
        if (senaPesos === "") {
          if (senaPorcentaje !== "") setSenaPorcentaje("");
        } else {
          const porcCalculado =
            Math.round((pesosNum / totalNum) * 100 * 100) / 100;
          const porcStr = porcCalculado.toString();
          if (porcStr !== senaPorcentaje) {
            setSenaPorcentaje(porcStr);
          }
        }
      } else if (ultimaEdicionSena === "porcentaje") {
        if (senaPorcentaje === "") {
          if (senaPesos !== "") setSenaPesos("");
          pesosNum = 0;
        } else {
          const pesosCalculado =
            Math.round(((totalNum * porcNum) / 100) * 100) / 100;
          const pesosStr = pesosCalculado.toString();
          if (pesosStr !== senaPesos) {
            setSenaPesos(pesosStr);
            pesosNum = pesosCalculado;
          }
        }
      }

      const saldoCalculado = totalNum - pesosNum;
      setSaldo(saldoCalculado >= 0 ? saldoCalculado.toString() : "0");
    } else {
      setSaldo("");
    }
  }, [total, senaPorcentaje, senaPesos, ultimaEdicionSena]);

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

    const renglonesValidos = renglones
      .filter((r) => r.tipo)
      .map((r) => ({ tipo: r.tipo, cantidad: parseInt(r.cantidad, 10) }));
    if (
      renglonesValidos.length === 0 ||
      renglonesValidos.some((r) => !(r.cantidad >= 1)) ||
      renglones.some((r) => !r.tipo)
    ) {
      setMensaje(
        "Elegí qué se vende (cortina completa, portón lama o reparación) y la cantidad de cada renglón."
      );
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

    const resueltos = progreso.current
      ? {
          clienteId: progreso.current.clienteId,
          direccionId: progreso.current.direccionId,
        }
      : await resolverClienteYDireccion(
      supabase,
      {
        nombre: cliente,
        direccion,
        localidad,
        userId: user.id,
      }
    );
    const { clienteId, direccionId } = resueltos;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error }: { data: any; error: any } = progreso.current
      ? {
          data: {
            id: progreso.current.id,
            numero_remito: progreso.current.numero,
          },
          error: null,
        }
      : await supabase
      .from("solicitudes_fabrica")
      .insert({
        cliente_id: clienteId,
        cliente_nombre: cliente.trim(),
        cliente_telefono: null,

        direccion: direccion.trim(),
        localidad: localidad.trim() || null,
        provincia: provincia.trim() || null,

        fecha: fecha || null,
        horario_desde: hDesde,
        horario_hasta: hHasta,
        tipo_visita: tipoVisita.trim() || null,

        observaciones: observacionesFinales,

        total_pesos: total ? Number(total) : null,
        saldo_restante: saldo ? Number(saldo) : null,

        sena_porcentaje: senaPorcentaje ? Number(senaPorcentaje) : null,
        sena_pesos: senaPesos ? Number(senaPesos) : null,

        medio_pago: medioPago || null,
        aclaracion_pago: aclaracionPago.trim() || null,

        estado: "PENDIENTE_APROBACION",
        creado_por: user.id,
      })
      .select("id, numero_remito")
      .single();

    if (error && clienteId) {
      // Reintento sin cliente_id por si falta correr el SQL nuevo
      const reintento = await supabase
        .from("solicitudes_fabrica")
        .insert({
          cliente_nombre: cliente.trim(),
          cliente_telefono: null,
          direccion: direccion.trim(),
          localidad: localidad.trim() || null,
          provincia: provincia.trim() || null,
          fecha: fecha || null,
          horario_desde: hDesde,
          horario_hasta: hHasta,
          tipo_visita: tipoVisita.trim() || null,
          observaciones: observacionesFinales,
          total_pesos: total ? Number(total) : null,
          saldo_restante: saldo ? Number(saldo) : null,
          sena_porcentaje: senaPorcentaje ? Number(senaPorcentaje) : null,
          sena_pesos: senaPesos ? Number(senaPesos) : null,
          medio_pago: medioPago || null,
          aclaracion_pago: aclaracionPago.trim() || null,
          estado: "PENDIENTE_APROBACION",
          creado_por: user.id,
        })
        .select("id, numero_remito")
        .single();
      data = reintento.data;
      error = reintento.error;
    }

    if (error) {
      console.error(error);
      setMensaje(error.message);
      setGuardando(false);
      return;
    }

    if (!progreso.current) {
      progreso.current = {
        id: data.id,
        numero: data.numero_remito,
        clienteId: clienteId ?? null,
        direccionId: direccionId ?? null,
        itemsOk: false,
        ventaId: null,
        pagoOk: false,
      };
    }
    const paso = progreso.current!;
    const guardarLocal = () => {
      try {
        localStorage.setItem(
          "croacia_pedido_pendiente",
          JSON.stringify({ ...paso, cuando: new Date().toISOString() })
        );
      } catch {
        // sin almacenamiento local: igual queda el aviso en pantalla
      }
    };
    guardarLocal();
    const avisoParcial = (que: string, detalle: string) => {
      console.error(que, detalle);
      setMensaje(
        `El remito Nº ${paso.numero} ya quedó cargado, pero falló un paso (${que}: ${detalle}). No lo des por completo: tocá guardar de nuevo para reintentar solo lo que falta (no se duplica el pedido).`
      );
      setGuardando(false);
    };

    // Qué se vende (para estadísticas)
    if (!paso.itemsOk) {
      const { count: yaHay } = await supabase
        .from("pedido_items")
        .select("id", { count: "exact", head: true })
        .eq("solicitud_fabrica_id", paso.id);
      if ((yaHay ?? 0) > 0) paso.itemsOk = true;
    }
    if (!paso.itemsOk) {
      const { error: errorItems } = await supabase.from("pedido_items").insert(
        renglonesValidos.map((r) => ({
          solicitud_fabrica_id: paso.id,
          tipo: r.tipo,
          cantidad: r.cantidad,
          creado_por: user.id,
        }))
      );
      if (errorItems) {
        avisoParcial("qué se vende", errorItems.message);
        return;
      }
      paso.itemsOk = true;
      guardarLocal();
    }

    // Venta automática (+ seña como primer pago si la cargaron)
    if (paso.clienteId) {
      if (!paso.ventaId) {
        const { data: ventaPrevia } = await supabase
          .from("ventas")
          .select("id")
          .eq("solicitud_fabrica_id", paso.id)
          .limit(1)
          .maybeSingle();
        if (ventaPrevia) paso.ventaId = ventaPrevia.id;
      }
      if (!paso.ventaId) {
        const { data: venta, error: errorVenta } = await supabase
          .from("ventas")
          .insert({
            cliente_id: paso.clienteId,
            direccion_id: paso.direccionId,
            descripcion: `Remito fábrica #${paso.numero}`,
            total: total ? Number(total) : 0,
            solicitud_fabrica_id: paso.id,
            creado_por: user.id,
          })
          .select("id")
          .single();
        if (errorVenta || !venta) {
          avisoParcial("venta del cliente", errorVenta?.message || "sin respuesta");
          return;
        }
        paso.ventaId = venta.id;
        guardarLocal();
      }

      const senaNum = parseFloat(senaPesos) || 0;
      if (senaNum > 0 && !paso.pagoOk) {
        const { count: pagosPrevios } = await supabase
          .from("pagos")
          .select("id", { count: "exact", head: true })
          .eq("venta_id", paso.ventaId);
        if ((pagosPrevios ?? 0) > 0) paso.pagoOk = true;
      }
      if (senaNum > 0 && !paso.pagoOk) {
        const { error: errorPago } = await supabase.from("pagos").insert({
          venta_id: paso.ventaId,
          monto: senaNum,
          fecha: new Date().toISOString().slice(0, 10),
          medio: [medioPago, aclaracionPago.trim()].filter(Boolean).join(" - ") || null,
          creado_por: user.id,
        });
        if (errorPago) {
          avisoParcial("seña", errorPago.message);
          return;
        }
        paso.pagoOk = true;
      }
    }

    try {
      localStorage.removeItem("croacia_pedido_pendiente");
    } catch {
      // nada
    }
    progreso.current = null;
    setExito(true);
    setMensaje(
      `¡Remito Nº ${data?.numero_remito} cargado correctamente! Redirigiendo...`
    );

    setGuardando(false);

    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 2000);
  }

  const inputClassName =
    "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {perfil && (
        <Sidebar
          nombre={perfil.nombre || "Usuario"}
          apellido={perfil.apellido || ""}
          rol={perfil.rol || "OFICINA"}
        />
      )}

      <main className="ml-0 min-h-screen bg-slate-50 p-6 md:ml-64 md:p-8 pt-20 md:pt-8">
      <div className="mx-auto max-w-4xl">
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
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
            Nuevo pedido para fábrica
          </h1>

          <p className="mt-2 text-slate-600">
            Cargá todos los datos del cliente y de la cortina.
          </p>
        </div>

        {mensaje && (
          <div
            className={`mb-6 flex items-center gap-3 rounded-xl border p-4 text-sm font-medium shadow-sm ${
              exito
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-700"
            }`}
          >
            {exito && (
              <CheckCircle2
                size={20}
                className="text-emerald-600 flex-shrink-0"
              />
            )}
            {mensaje}
          </div>
        )}

        <div className="space-y-6">
          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Datos del cliente
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <ClienteAutocomplete
                cliente={cliente}
                setCliente={setCliente}
                direccion={direccion}
                setDireccion={setDireccion}
                localidad={localidad}
                setLocalidad={setLocalidad}
                onProvinciaChange={setProvincia}
                inputClassName={inputClassName}
              />
            </div>
          </section>

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Qué se vende
            </h2>
            <div className="mt-5 space-y-3">
              {renglones.map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={r.tipo}
                    onChange={(e) =>
                      setRenglones(
                        renglones.map((x, j) =>
                          j === i ? { ...x, tipo: e.target.value } : x
                        )
                      )
                    }
                    className={inputClassName}
                    disabled={exito}
                  >
                    <option value="">Elegí qué es...</option>
                    {tiposVenta.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={r.cantidad}
                    onChange={(e) =>
                      setRenglones(
                        renglones.map((x, j) =>
                          j === i ? { ...x, cantidad: e.target.value } : x
                        )
                      )
                    }
                    className={inputClassName + " max-w-[6rem]"}
                    disabled={exito}
                    aria-label="Cantidad"
                  />
                  {renglones.length > 1 && !exito && (
                    <button
                      type="button"
                      onClick={() =>
                        setRenglones(renglones.filter((_, j) => j !== i))
                      }
                      className="rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                    >
                      Quitar
                    </button>
                  )}
                </div>
              ))}
              {!exito && (
                <button
                  type="button"
                  onClick={() =>
                    setRenglones([...renglones, { tipo: "", cantidad: "1" }])
                  }
                  className="text-sm font-medium text-blue-700 hover:underline"
                >
                  + Agregar otro renglón
                </button>
              )}
            </div>
          </section>

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
                <label className="mb-1 block text-sm font-medium">
                  Tipo de visita
                </label>
                <select
                  value={tipoVisita}
                  onChange={(e) => setTipoVisita(e.target.value)}
                  className={inputClassName}
                  disabled={exito}
                >
                  <option value="">Seleccionar...</option>
                  {tiposVisita.map((tipo) => (
                    <option key={tipo} value={tipo}>
                      {tipo}
                    </option>
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

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Datos comerciales
            </h2>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Total en pesos
                </label>
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
                <label className="mb-1 block text-sm font-medium">
                  Saldo restante (Automático)
                </label>
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
                <label className="mb-1 block text-sm font-medium">
                  Seña (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={senaPorcentaje}
                  onChange={(e) => {
                    setSenaPorcentaje(e.target.value);
                    setUltimaEdicionSena("porcentaje");
                  }}
                  placeholder="Ej: 50"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Seña ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={senaPesos}
                  onChange={(e) => {
                    setSenaPesos(e.target.value);
                    setUltimaEdicionSena("pesos");
                  }}
                  placeholder="Ej: 425000"
                  className={inputClassName}
                  disabled={exito}
                />
              </div>
            </div>

            {(parseFloat(senaPesos) || 0) > (parseFloat(total) || 0) &&
              (parseFloat(total) || 0) > 0 && (
                <p className="mt-2 text-sm font-medium text-red-600">
                  La seña es mayor al total. Revisá el monto.
                </p>
              )}

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">
                Medio de pago
              </label>
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

          <button
            type="button"
            onClick={guardarSolicitud}
            disabled={guardando || exito}
            className="w-full rounded-xl bg-slate-900 px-5 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando
              ? "Guardando remito..."
              : exito
              ? "¡Pedido guardado con éxito!"
              : "Crear pedido y enviar a aprobación"}
          </button>
        </div>
      </div>
    </main>
    </div>
  );
            }
