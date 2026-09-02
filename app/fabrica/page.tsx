import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import ActualizarEstadoFabrica from "@/components/ActualizarEstadoFabrica";
import {
  Factory,
  ClipboardList,
  MapPin,
  User,
  Calendar,
  AlertTriangle,
} from "lucide-react";

export default async function FabricaPage() {
  const supabase = await createClient();

  // ==========================================
  // USUARIO
  // ==========================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // ==========================================
  // PERFIL
  // ==========================================

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  // Solo usuarios de fábrica
  if (
    !["FABRICA", "ADMIN"].includes(
      profile.rol
    )
  ) {
    redirect("/dashboard");
  }

  // ==========================================
  // SOLICITUDES PARA FÁBRICA
  // ==========================================

  const { data: solicitudes, error } =
    await supabase
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
      .in("estado", [
        "ASIGNADO_FABRICA",
        "EN_FABRICACION",
        "FALTANTES",
      ])
      .order("created_at", {
        ascending: false,
      });

  const trabajos =
    solicitudes || [];

  // ==========================================
  // CONTADORES
  // ==========================================

  const asignados = trabajos.filter(
    (s) =>
      s.estado ===
      "ASIGNADO_FABRICA"
  ).length;

  const enFabricacion = trabajos.filter(
    (s) =>
      s.estado ===
      "EN_FABRICACION"
  ).length;

  const faltantes = trabajos.filter(
    (s) =>
      s.estado ===
      "FALTANTES"
  ).length;

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={profile.nombre}
        apellido={profile.apellido || ""}
        rol={profile.rol}
      />

      <main className="ml-64 min-h-screen p-8">
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

              <h1 className="text-3xl font-bold text-slate-900">
                Trabajos de fábrica
              </h1>
            </div>
          </div>
        </div>

        {/* RESUMEN */}

        <div className="mb-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Asignados
            </p>

            <p className="mt-2 text-3xl font-bold text-slate-900">
              {asignados}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              En fabricación
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-600">
              {enFabricacion}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm text-slate-500">
              Con faltantes
            </p>

            <p className="mt-2 text-3xl font-bold text-amber-600">
              {faltantes}
            </p>
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="mb-6 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            Error al cargar los trabajos de fábrica.
          </div>
        )}

        {/* SIN TRABAJOS */}

        {!error && trabajos.length === 0 && (
          <div className="rounded-2xl bg-white p-12 text-center shadow-sm">
            <Factory
              size={48}
              className="mx-auto text-slate-300"
            />

            <h2 className="mt-4 text-lg font-bold text-slate-900">
              No hay trabajos pendientes
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Actualmente no hay trabajos
              asignados a fábrica.
            </p>
          </div>
        )}

        {/* LISTA */}

        <div className="space-y-5">
          {trabajos.map((solicitud) => (
            <div
              key={solicitud.id}
              className="rounded-2xl bg-white p-6 shadow-sm"
            >
              {/* CABECERA */}

              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-5 md:flex-row md:items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-slate-900">
                      #{String(
                        solicitud.numero ||
                          solicitud.id
                      ).padStart(5, "0")}
                    </span>

                    <EstadoFabrica
                      estado={
                        solicitud.estado
                      }
                    />
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Tipo:{" "}
                    {solicitud.tipo_visita ||
                      "Sin especificar"}
                  </p>
                </div>
              </div>

              {/* DATOS */}

              <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
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
                      {solicitud.cliente_nombre ||
                        "-"}
                    </p>

                    {solicitud.cliente_telefono && (
                      <p className="text-sm text-slate-500">
                        {solicitud.cliente_telefono}
                      </p>
                    )}
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
                      {solicitud.direccion ||
                        "-"}
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

                    <p className="mt-1 text-sm font-semibold text-slate-800">
                      {solicitud.fecha
                        ? new Date(
                            `${solicitud.fecha}T12:00:00`
                          ).toLocaleDateString(
                            "es-AR"
                          )
                        : "-"}
                    </p>

                    {(solicitud.horario_desde ||
                      solicitud.horario_hasta) && (
                      <p className="text-sm text-slate-500">
                        {solicitud.horario_desde ||
                          "--:--"}
                        {" - "}
                        {solicitud.horario_hasta ||
                          "--:--"}
                      </p>
                    )}
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
                      Detalle de la solicitud
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                      {solicitud.observaciones ||
                        "No se agregaron observaciones."}
                    </p>
                  </div>
                </div>
              </div>

              {/* ALERTA FALTANTES */}

              {solicitud.estado ===
                "FALTANTES" && (
                <div className="mt-5 flex items-center gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">
                  <AlertTriangle size={20} />

                  <span>
                    Este trabajo tiene faltantes
                    y está esperando resolución.
                  </span>
                </div>
              )}

              {/* CAMBIO DE ESTADO */}

              <div className="mt-6 border-t border-slate-100 pt-5">
                <ActualizarEstadoFabrica
                  solicitudId={
                    solicitud.id
                  }
                  estadoActual={
                    solicitud.estado
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

// ==========================================
// BADGE DE ESTADO
// ==========================================

function EstadoFabrica({
  estado,
}: {
  estado: string;
}) {
  const estilos: Record<
    string,
    string
  > = {
    ASIGNADO_FABRICA:
      "bg-slate-100 text-slate-700",

    EN_FABRICACION:
      "bg-blue-100 text-blue-700",

    FALTANTES:
      "bg-amber-100 text-amber-700",
  };

  const nombres: Record<
    string,
    string
  > = {
    ASIGNADO_FABRICA:
      "Asignado a fábrica",

    EN_FABRICACION:
      "En fabricación",

    FALTANTES:
      "Faltantes",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${
        estilos[estado] ||
        "bg-slate-100 text-slate-600"
      }`}
    >
      {nombres[estado] || estado}
    </span>
  );
}