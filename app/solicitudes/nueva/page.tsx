"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/cliente";
import {
  ArrowLeft,
  Save,
  UserRound,
  CalendarDays,
  Clock,
  ClipboardList,
  BellRing,
} from "lucide-react";

const tiposVisita = [
  "Ir a medir",
  "Presupuesto aceptado",
  "Mantenimiento",
  "Presupuesto",
  "Retiro",
  "Amurar guias",
  "Supervision",
  "Urgencia",
  "Trabajo aceptado",
  "Trabajo pendiente",
];

export default function NuevaSolicitudPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const [cliente, setCliente] = useState("");
  const [direccion, setDireccion] = useState("");
  const [localidad, setLocalidad] = useState("");

  const [fecha, setFecha] = useState("");
  const [tipoVisita, setTipoVisita] = useState("");
  
  const [franjaHoraria, setFranjaHoraria] = useState("");
  const [preferencia, setPreferencia] = useState("");
  
  const [observaciones, setObservaciones] = useState("");

  useEffect(() => {
    async function verificarUsuario() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("rol")
        .eq("id", user.id)
        .single();

      if (!profile || !["ADMIN", "OFICINA"].includes(profile.rol)) {
        router.push("/dashboard");
        return;
      }

      setLoading(false);
    }

    verificarUsuario();
  }, [router, supabase]);

  async function crearSolicitud(e: FormEvent) {
    e.preventDefault();

    setError("");
    setGuardando(true);

    try {
      if (!cliente.trim()) throw new Error("Ingresá el nombre del cliente.");
      if (!direccion.trim()) throw new Error("Ingresá la dirección.");
      if (!fecha) throw new Error("Seleccioná una fecha.");
      if (!tipoVisita) throw new Error("Seleccioná el tipo de visita.");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("La sesión expiró.");
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

      const { data: clienteCreado, error: clienteError } = await supabase
        .from("clientes")
        .insert({
          nombre: cliente.trim(),
          telefono: null, // Se envía null ya que quitamos el campo
          direccion: direccion.trim(),
          localidad: localidad.trim() || null,
        })
        .select("id")
        .single();

      if (clienteError || !clienteCreado) {
        throw new Error(clienteError?.message || "No se pudo crear el cliente.");
      }

      const { data: solicitud, error: solicitudError } = await supabase
        .from("solicitudes")
        .insert({
          cliente_id: clienteCreado.id,
          cliente_nombre: cliente.trim(),
          cliente_telefono: null, // Se envía null
          direccion: direccion.trim(),
          localidad: localidad.trim() || null,
          fecha,
          horario_desde: hDesde,
          horario_hasta: hHasta,
          tipo_visita: tipoVisita,
          observaciones: observacionesFinales,
          estado: "PENDIENTE",
          creado_por: user.id,
        })
        .select("numero")
        .single();

      if (solicitudError || !solicitud) {
        throw new Error(solicitudError?.message || "No se pudo crear la solicitud.");
      }

      router.push("/solicitudes");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error inesperado.");
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Cargando...</p>
      </div>
    );
  }

  const inputClassName = "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200";

  return (
    <main className="min-h-screen bg-slate-100 p-6 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <button
            onClick={() => router.push("/solicitudes")}
            className="mb-5 flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Volver a solicitudes
          </button>

          <h1 className="text-3xl font-bold text-slate-900">Nueva solicitud</h1>
          <p className="mt-1 text-slate-500">
            Cargá los datos necesarios para solicitar un trabajo.
          </p>
        </div>

        <form onSubmit={crearSolicitud} className="space-y-6">
          {/* Cliente y Ubicación */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-3">
                <UserRound size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Datos del cliente y ubicación</h2>
                <p className="text-sm text-slate-500">Información principal del trabajo</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Nombre / Razón social *
                </label>
                <input
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  placeholder="Ej: Juan Pérez"
                  className={inputClassName}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Dirección *
                </label>
                <input
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  placeholder="Ej: Av. Mitre 1234"
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Localidad
                </label>
                <input
                  value={localidad}
                  onChange={(e) => setLocalidad(e.target.value)}
                  placeholder="Ej: Quilmes"
                  className={inputClassName}
                />
              </div>
            </div>
          </section>

          {/* Visita */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-3">
                <CalendarDays size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Datos de la visita</h2>
                <p className="text-sm text-slate-500">
                  Cuándo y qué trabajo se necesita
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fecha *
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className={inputClassName}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Tipo de visita *
                </label>
                <select
                  value={tipoVisita}
                  onChange={(e) => setTipoVisita(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Seleccionar...</option>
                  {tiposVisita.map((tipo) => (
                    <option key={tipo} value={tipo}>{tipo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Clock size={16} />
                  Franja Horaria
                </label>
                <select
                  value={franjaHoraria}
                  onChange={(e) => setFranjaHoraria(e.target.value)}
                  className={inputClassName}
                >
                  <option value="">Coordinar con cliente...</option>
                  <option value="mañana">Por la mañana (08:00 a 12:00)</option>
                  <option value="tarde">Por la tarde (13:00 a 17:00)</option>
                  <option value="completo">Día completo (08:00 a 17:00)</option>
                </select>
              </div>

              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <BellRing size={16} />
                  Aviso / Preferencia
                </label>
                <input
                  type="text"
                  value={preferencia}
                  onChange={(e) => setPreferencia(e.target.value)}
                  placeholder="Ej: Avisar media hora antes..."
                  className={inputClassName}
                />
              </div>
            </div>
          </section>

          {/* Observaciones */}
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="rounded-xl bg-slate-100 p-3">
                <ClipboardList size={20} />
              </div>
              <div>
                <h2 className="font-semibold text-slate-900">Observaciones</h2>
                <p className="text-sm text-slate-500">
                  Información adicional para coordinación y técnico
                </p>
              </div>
            </div>

            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={6}
              placeholder="Escribí cualquier información importante para realizar el trabajo..."
              className={`${inputClassName} resize-none`}
            />
          </section>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Botones */}
          <div className="flex justify-end gap-3 pb-8">
            <button
              type="button"
              onClick={() => router.push("/solicitudes")}
              className="rounded-xl border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={guardando}
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={18} />
              {guardando ? "Guardando..." : "Crear solicitud"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}