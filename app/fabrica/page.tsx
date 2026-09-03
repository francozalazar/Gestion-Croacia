import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import {
  Factory,
  ClipboardList,
  MapPin,
  User,
  Calendar,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

export default async function FabricaPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  if (
    !["FABRICA", "ADMIN"].includes(
      profile.rol
    )
  ) {
    redirect("/dashboard");
  }

  // Consultamos los remitos en solicitudes_fabrica que estén activos en producción
  const { data: solicitudes, error } =
    await supabase
      .from("solicitudes_fabrica")
      .select("*")
      .in("estado", ["EN_CORTE", "EN_FABRICACION", "FALTANTES"])
      .order("created_at", {
        ascending: false,
      });

  const trabajos = solicitudes || [];

  // Contadores para las tarjetas de arriba
  const enCorte = trabajos.filter((s) => s.estado === "EN_CORTE").length;
  const enFabricacion = trabajos.filter((s) => s.estado === "EN_FABRICACION").length;
  const faltantes = trabajos.filter((s) => s.estado === "FALTANTES").length;

  // Server Action para cambiar estados o enviar a coordinación
  async function actualizarEstado(formData: FormData) {
    "use server";
    const id = formData.get("id");
    const nuevoEstado = formData.get("nuevoEstado");

    const supabaseAction = await createClient();

    if (nuevoEstado === "LISTO_INSTALACION") {
      // Si está listo, lo marcamos como finalizado o listo para coordinación en fábrica
      await supabaseAction
        .from("solicitudes_fabrica")
        .update({ estado: "LISTO_INSTALACION" })
        .eq("id", id);
    } else {
      await supabaseAction
        .from("solicitudes_fabrica")
        .update({ estado: nuevoEstado })
        .eq("id", id);
    }

    revalidatePath("/fabrica");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={profile.nombre}
        apellido={profile.apellido || ""}
        rol={profile.rol}
      />

      <main className="ml-0 md:ml-64 min-h-screen p-4 md:p-8 pt-20 md:pt-8">
        
        {/* BOTÓN PARA VOLVER ATRÁS */}
        <div className="mb-6">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          >
            <ArrowLeft size={18} />
            Volver al inicio
          </Link>
        </div>

        {/* ENCABEZADO */}
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Factory size={24} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Gestión de producción
              </p>

              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Trabajos de fábrica
              </h1>
            </div>
          </div>
        </div>

        {/* RESUMEN / CONTADORES */}
        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">En corte / Asignados</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{enCorte}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">En fabricación</p>
            <p className="mt-2 text-3xl font-bold text-blue-600">{enFabricacion}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">Con faltantes</p>
            <p className="mt-2 text-3xl font-bold text-amber-600">{faltantes}</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Error al cargar los trabajos de fábrica.
          </div>
        )}

        {!error && trabajos.length === 0 && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <Factory size={48} className="mx-auto text-slate-300" />
            <h2 className="mt-4 text-lg font-bold text-slate-900">
              No hay trabajos pendientes en fábrica
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Cuando administración apruebe y envíe un remito, aparecerá acá.
            </p>
          </div>
        )}

        {/* LISTA DE TRABAJOS */}
        <div className="space-y-5">
          {trabajos.map((solicitud) => {
            const estadoActual = solicitud.estado;

            return (
              <div
                key={solicitud.id}
                className="rounded-2xl bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start">
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-lg font-bold text-slate-900">
                        Remito Nº {solicitud.numero_remito}
                      </span>

                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        estadoActual === "EN_CORTE" ? "bg-slate-100 text-slate-700" :
                        estadoActual === "EN_FABRICACION" ? "bg-blue-100 text-blue-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>
                        {estadoActual === "EN_CORTE" ? "En corte" :
                         estadoActual === "EN_FABRICACION" ? "En fabricación" : "Faltantes"}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      Tipo: {solicitud.tipo_visita || "Sin especificar"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {/* CLIENTE */}
                  <div className="flex gap-3">
                    <User size={18} className="mt-0.5 text-slate-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400">Cliente</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {solicitud.cliente_nombre || "-"}
                      </p>
                      {solicitud.cliente_telefono && (
                        <p className="text-sm text-slate-500">{solicitud.cliente_telefono}</p>
                      )}
                    </div>
                  </div>

                  {/* DIRECCIÓN */}
                  <div className="flex gap-3">
                    <MapPin size={18} className="mt-0.5 text-slate-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400">Dirección</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {solicitud.direccion || "-"}
                      </p>
                      {solicitud.localidad && (
                        <p className="text-sm text-slate-500">{solicitud.localidad}</p>
                      )}
                    </div>
                  </div>

                  {/* FECHA */}
                  <div className="flex gap-3">
                    <Calendar size={18} className="mt-0.5 text-slate-400 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium uppercase text-slate-400">Fecha solicitada</p>
                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {solicitud.fecha
                          ? new Date(`${solicitud.fecha}T12:00:00`).toLocaleDateString("es-AR")
                          : "-"}
                      </p>
                      {(solicitud.horario_desde || solicitud.horario_hasta) && (
                        <p className="text-sm text-slate-500">
                          {solicitud.horario_desde || "--:--"} - {solicitud.horario_hasta || "--:--"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* DETALLE / OBSERVACIONES */}
                <div className="mt-6 rounded-xl bg-slate-50 p-5">
                  <div className="flex items-start gap-3">
                    <ClipboardList size={19} className="mt-0.5 text-slate-500 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Detalle de las cortinas / Observaciones
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                        {solicitud.observaciones || "No se agregaron observaciones."}
                      </p>
                    </div>
                  </div>
                </div>

                {/* DATOS ECONÓMICOS Y PAGOS */}
                <div className="mt-5 border-t border-slate-100 pt-4 flex flex-wrap gap-6 text-sm text-slate-700">
                  <div>
                    <span className="font-medium text-slate-400">Total: </span>
                    <span className="font-bold">${solicitud.total_pesos ?? "-"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-400">Saldo: </span>
                    <span className="font-bold">${solicitud.saldo_restante ?? "-"}</span>
                  </div>
                  <div>
                    <span className="font-medium text-slate-400">Pago: </span>
                    <span>{solicitud.medio_pago ?? "-"}</span>
                  </div>
                </div>

                {/* BOTONES DE CAMBIO DE ESTADO (Acciones de Fábrica) */}
                <div className="mt-6 border-t border-slate-100 pt-5 flex flex-wrap gap-3 items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-slate-400">
                    Cambiar estado de producción:
                  </span>

                  <div className="flex flex-wrap gap-2">
                    <form action={actualizarEstado}>
                      <input type="hidden" name="id" value={solicitud.id} />
                      <input type="hidden" name="nuevoEstado" value="EN_FABRICACION" />
                      <button
                        type="submit"
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                          estadoActual === "EN_FABRICACION"
                            ? "bg-blue-600 text-white"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        En fabricación
                      </button>
                    </form>

                    <form action={actualizarEstado}>
                      <input type="hidden" name="id" value={solicitud.id} />
                      <input type="hidden" name="nuevoEstado" value="FALTANTES" />
                      <button
                        type="submit"
                        className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                          estadoActual === "FALTANTES"
                            ? "bg-amber-600 text-white"
                            : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                        }`}
                      >
                        Con faltantes
                      </button>
                    </form>

                    <form action={actualizarEstado}>
                      <input type="hidden" name="id" value={solicitud.id} />
                      <input type="hidden" name="nuevoEstado" value="LISTO_INSTALACION" />
                      <button
                        type="submit"
                        className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                      >
                        ✓ Listo para coordinar / instalar
                      </button>
                    </form>
                  </div>
                </div>

              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}