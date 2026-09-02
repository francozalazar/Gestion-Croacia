"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/cliente";
import { useRouter } from "next/navigation";

export default function SolicitudFabricaPage() {
  const supabase = createClient();
  const router = useRouter();

  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");

  const [fecha, setFecha] = useState("");
  const [horarioDesde, setHorarioDesde] = useState("");
  const [horarioHasta, setHorarioHasta] = useState("");
  const [tipoVisita, setTipoVisita] = useState("");

  const [observaciones, setObservaciones] = useState("");

  const [total, setTotal] = useState("");
  const [saldo, setSaldo] = useState("");

  const [senaPorcentaje, setSenaPorcentaje] = useState("");
  const [senaPesos, setSenaPesos] = useState("");

  const [medioPago, setMedioPago] = useState("");

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");

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

    const { data, error } = await supabase
      .from("solicitudes_fabrica")
      .insert({
        cliente_nombre: cliente.trim(),
        cliente_telefono: telefono.trim() || null,

        direccion: direccion.trim(),
        localidad: localidad.trim() || null,

        fecha: fecha || null,
        horario_desde: horarioDesde || null,
        horario_hasta: horarioHasta || null,
        tipo_visita: tipoVisita.trim() || null,

        observaciones: observaciones.trim() || null,

        total_pesos: total ? Number(total) : null,
        saldo_restante: saldo ? Number(saldo) : null,

        sena_porcentaje: senaPorcentaje
          ? Number(senaPorcentaje)
          : null,

        sena_pesos: senaPesos
          ? Number(senaPesos)
          : null,

        medio_pago: medioPago || null,

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

    setMensaje(
      `Remito Nº ${data.numero_remito} creado correctamente y enviado a aprobación.`
    );

    setGuardando(false);

    setCliente("");
    setTelefono("");
    setDireccion("");
    setLocalidad("");
    setFecha("");
    setHorarioDesde("");
    setHorarioHasta("");
    setTipoVisita("");
    setObservaciones("");
    setTotal("");
    setSaldo("");
    setSenaPorcentaje("");
    setSenaPesos("");
    setMedioPago("");

    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <div className="mx-auto max-w-4xl">

        <Link
          href="/dashboard"
          className="mb-6 inline-block text-sm text-slate-600 hover:text-slate-900"
        >
          ← Volver al inicio
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Nuevo remito para fábrica
          </h1>

          <p className="mt-2 text-slate-600">
            Cargá todos los datos del cliente y de la cortina.
          </p>
        </div>

        {mensaje && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
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

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Cliente *
                </label>

                <input
                  type="text"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Nombre y apellido"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Teléfono
                </label>

                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  placeholder="Teléfono"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                <label className="mb-1 block text-sm font-medium">
                  Fecha
                </label>

                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Tipo de visita
                </label>

                <input
                  type="text"
                  value={tipoVisita}
                  onChange={(e) => setTipoVisita(e.target.value)}
                  placeholder="Ej: Instalación"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Horario desde
                </label>

                <input
                  type="time"
                  value={horarioDesde}
                  onChange={(e) => setHorarioDesde(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Horario hasta
                </label>

                <input
                  type="time"
                  value={horarioHasta}
                  onChange={(e) => setHorarioHasta(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>
          </section>

          {/* DATOS COMERCIALES */}

          <section className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">
              Datos comerciales
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Estos valores se cargan manualmente. El sistema no registra
              pagos ni calcula el saldo.
            </p>

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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Saldo restante
                </label>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={saldo}
                  onChange={(e) => setSaldo(e.target.value)}
                  placeholder="Ej: 425000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                  onChange={(e) =>
                    setSenaPorcentaje(e.target.value)
                  }
                  placeholder="Ej: 50"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                  onChange={(e) => setSenaPesos(e.target.value)}
                  placeholder="Ej: 425000"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
              </div>

            </div>

            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium">
                Medio de pago
              </label>

              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">
                  Seleccionar medio de pago
                </option>

                <option value="Efectivo">
                  Efectivo
                </option>

                <option value="Santander">
                  Santander
                </option>

                <option value="Mercado Pago">
                  Mercado Pago
                </option>

                <option value="Cuenta corriente">
                  Cuenta corriente
                </option>
              </select>
            </div>
          </section>

          {/* BOTON */}

          <button
            type="button"
            onClick={guardarSolicitud}
            disabled={guardando}
            className="w-full rounded-xl bg-slate-900 px-5 py-4 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {guardando
              ? "Guardando remito..."
              : "Crear remito y enviar a aprobación"}
          </button>

        </div>
      </div>
    </main>
  );
}