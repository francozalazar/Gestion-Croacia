import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import EnviarACoordinacion from "@/components/EnviarACoordinacion";
import Link from "next/link";
import {
  Factory,
  MapPin,
  User,
  Phone,
  ClipboardList,
  Calendar,
  ArrowLeft,
} from "lucide-react";

export default async function ListosParaColocarPage() {
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

  if (!["OFICINA", "ADMIN"].includes(profile.rol)) {
    redirect("/dashboard");
  }

  // Consultamos directamente de solicitudes_fabrica los que estén listos
  const { data: solicitudes, error } = await supabase
    .from("solicitudes_fabrica")
    .select("*")
    .eq("estado", "LISTO_PARA_COLOCAR")
    .order("created_at", {
      ascending: false,
    });

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
        <div className="mb-8 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Factory size={24} />
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Producción terminada
              </p>

              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Listos para colocar
              </h1>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Error al cargar los trabajos.
          </div>
        )}

        {!error &&
          (!solicitudes || solicitudes.length === 0) && (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
              <Factory
                size={48}
                className="mx-auto text-slate-300"
              />

              <h2 className="mt-4 text-lg font-bold text-slate-900">
                No hay trabajos listos para colocar
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Cuando fábrica termine un trabajo, aparecerá aquí.
              </p>
            </div>
          )}

        <div className="space-y-5">
          {solicitudes?.map((solicitud) => (
            <div
              key={solicitud.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              {/* CABECERA */}
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 md:flex-row">
                <div>
                  <span className="text-lg font-bold text-slate-900">
                    Remito Nº {solicitud.numero_remito}
                  </span>

                  <p className="mt-2 text-sm text-slate-500">
                    {solicitud.tipo_visita ||
                      "Sin tipo especificado"}
                  </p>
                </div>

                <span className="inline-flex h-fit rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                  ✓ Listo para colocar
                </span>
              </div>

              {/* DATOS */}
              <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* CLIENTE */}
                <div className="flex gap-3">
                  <User
                    size={18}
                    className="mt-0.5 text-slate-400 flex-shrink-0"
                  />

                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">
                      Cliente
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {solicitud.cliente_nombre || "-"}
                    </p>
                  </div>
                </div>

                {/* TELÉFONO */}
                <div className="flex gap-3">
                  <Phone
                    size={18}
                    className="mt-0.5 text-slate-400 flex-shrink-0"
                  />

                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">
                      Teléfono
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {solicitud.cliente_telefono || "-"}
                    </p>
                  </div>
                </div>

                {/* DIRECCIÓN */}
                <div className="flex gap-3">
                  <MapPin
                    size={18}
                    className="mt-0.5 text-slate-400 flex-shrink-0"
                  />

                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">
                      Dirección
                    </p>

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {solicitud.direccion || "-"}
                    </p>

                    {solicitud.localidad && (
                      <p className="text-sm text-slate-500">
                        {solicitud.localidad}
                      </p>
                    )}
                  </div>
                </div>

                {/* FECHA */}
                <div className="flex gap-3">
                  <Calendar
                    size={18}
                    className="mt-0.5 text-slate-400 flex-shrink-0"
                  />

                  <div>
                    <p className="text-xs font-medium uppercase text-slate-400">
                      Fecha solicitada
                    </p>

                    <p className="mt-1 text-sm text-slate-700">
                      {solicitud.fecha
                        ? new Date(
                            `${solicitud.fecha}T12:00:00`
                          ).toLocaleDateString("es-AR")
                        : "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* DETALLE */}
              <div className="mt-6 rounded-xl bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <ClipboardList
                    size={19}
                    className="mt-0.5 text-slate-500 flex-shrink-0"
                  />

                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Detalle de las cortinas / Observaciones
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {solicitud.observaciones ||
                        "No se agregaron observaciones."}
                    </p>
                  </div>
                </div>
              </div>

              {/* DATOS ECONÓMICOS */}
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

            </div>
          ))}
        </div>
      </main>
    </div>
  );
}