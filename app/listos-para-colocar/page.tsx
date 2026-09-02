import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import EnviarACoordinacion from "@/components/EnviarACoordinacion";
import {
  Factory,
  MapPin,
  User,
  Phone,
  ClipboardList,
  Calendar,
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

  // Solo Oficina y Admin
  if (!["OFICINA", "ADMIN"].includes(profile.rol)) {
    redirect("/dashboard");
  }

  const { data: solicitudes, error } = await supabase
    .from("solicitudes")
    .select(`
      id,
      numero,
      cliente_nombre,
      cliente_telefono,
      direccion,
      localidad,
      fecha,
      horario_desde,
      horario_hasta,
      tipo_visita,
      observaciones,
      estado,
      created_at
    `)
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

      <main className="ml-64 min-h-screen p-8">
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

              <h1 className="text-3xl font-bold text-slate-900">
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
                Cuando fábrica termine un trabajo,
                aparecerá aquí.
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
                    #{String(
                      solicitud.numero || solicitud.id
                    ).padStart(5, "0")}
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
                    className="mt-0.5 text-slate-400"
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
                    className="mt-0.5 text-slate-400"
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
                    className="mt-0.5 text-slate-400"
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
                    className="mt-0.5 text-slate-400"
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
                    className="mt-0.5 text-slate-500"
                  />

                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Detalle original de la solicitud
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {solicitud.observaciones ||
                        "No se agregaron observaciones."}
                    </p>
                  </div>
                </div>
              </div>

              {/* ACCIÓN */}

              <div className="mt-6 border-t border-slate-100 pt-5">
                <EnviarACoordinacion
                  solicitudId={solicitud.id}
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}