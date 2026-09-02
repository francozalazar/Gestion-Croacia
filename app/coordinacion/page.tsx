import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AsignarSolicitud from "@/components/AsignarSolicitud";

export default async function CoordinacionPage() {
  const supabase = await createClient();

  // =========================
  // USUARIO
  // =========================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // =========================
  // PERFIL
  // =========================

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (
    !perfil ||
    !["ADMIN", "COORDINACION"].includes(
      perfil.rol
    )
  ) {
    redirect("/dashboard");
  }

  // =========================
  // SOLICITUDES
  // =========================
  // Incluimos las nuevas que vuelven
  // desde Oficina después de Fábrica

  const {
    data: solicitudes,
    error: solicitudesError,
  } = await supabase
    .from("solicitudes")
    .select("*")
    .in("estado", [
      "PENDIENTE",
      "ASIGNADO",
      "PENDIENTE_COORDINACION",
    ])
    .order("created_at", {
      ascending: false,
    });

  // =========================
  // CLIENTES
  // =========================

  const clienteIds =
    solicitudes
      ?.map((s) => s.cliente_id)
      .filter(Boolean) || [];

  let clientes: any[] = [];

  if (clienteIds.length > 0) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .in("id", clienteIds);

    clientes = data || [];
  }

  // =========================
  // ASIGNACIONES
  // =========================

  const solicitudIds =
    solicitudes?.map((s) => s.id) || [];

  let asignaciones: any[] = [];

  if (solicitudIds.length > 0) {
    const { data } = await supabase
      .from("asignaciones")
      .select("*")
      .in("solicitud_id", solicitudIds);

    asignaciones = data || [];
  }

  // =========================
  // USUARIOS
  // =========================

  const {
    data: usuarios,
    error: usuariosError,
  } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, rol")
    .in("rol", [
      "TECNICO",
      "FABRICA",
    ])
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido || ""}
        rol={perfil.rol}
      />

      <main className="ml-64 flex-1 p-8">
        {/* ENCABEZADO */}

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Coordinación
          </h1>

          <p className="mt-2 text-gray-600">
            Administrá y asigná las solicitudes
            de trabajo.
          </p>
        </div>

        {/* ERROR SOLICITUDES */}

        {solicitudesError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">
              Error al cargar las solicitudes
            </p>

            <p className="mt-1 text-sm text-red-700">
              {solicitudesError.message}
            </p>
          </div>
        )}

        {/* ERROR USUARIOS */}

        {usuariosError && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="font-semibold text-red-800">
              Error al cargar técnicos/fábrica
            </p>

            <p className="mt-1 text-sm text-red-700">
              {usuariosError.message}
            </p>
          </div>
        )}

        {/* SIN SOLICITUDES */}

        {!solicitudes ||
        solicitudes.length === 0 ? (
          <div className="rounded-xl bg-white p-10 text-center shadow">
            <p className="text-lg font-medium text-gray-700">
              No hay solicitudes pendientes de
              asignación.
            </p>

            <p className="mt-2 text-gray-500">
              Cuando Oficina cree una nueva solicitud
              o envíe un trabajo terminado de Fábrica,
              aparecerá acá.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {solicitudes.map(
              (solicitud) => {
                // =========================
                // CLIENTE
                // =========================

                const cliente =
                  clientes.find(
                    (c) =>
                      c.id ===
                      solicitud.cliente_id
                  );

                // =========================
                // ASIGNACIÓN
                // =========================

                const asignacion =
                  asignaciones.find(
                    (a) =>
                      a.solicitud_id ===
                      solicitud.id
                  );

                const usuarioAsignado =
                  asignacion
                    ? usuarios?.find(
                        (u) =>
                          u.id ===
                          asignacion.usuario_id
                      )
                    : null;

                const vuelveDeFabrica =
                  solicitud.estado ===
                  "PENDIENTE_COORDINACION";

                return (
                  <div
                    key={solicitud.id}
                    className="rounded-xl bg-white p-6 shadow"
                  >
                    <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
                      {/* ========================= */}
                      {/* INFORMACIÓN */}
                      {/* ========================= */}

                      <div className="flex-1">
                        <div className="mb-4 flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-gray-900 px-3 py-1 text-sm font-bold text-white">
                            #
                            {String(
                              solicitud.numero
                            ).padStart(
                              5,
                              "0"
                            )}
                          </span>

                          <EstadoBadge
                            estado={
                              solicitud.estado
                            }
                          />

                          {vuelveDeFabrica && (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">
                              🏭 Viene de fábrica
                            </span>
                          )}
                        </div>

                        {/* CLIENTE */}

                        <h2 className="text-xl font-bold text-gray-900">
                          {cliente?.nombre ||
                            solicitud.cliente_nombre ||
                            "Cliente sin nombre"}
                        </h2>

                        {/* DATOS */}

                        <div className="mt-4 grid gap-3 text-sm text-gray-600 md:grid-cols-2">
                          <p>
                            <strong>
                              Dirección:
                            </strong>{" "}
                            {solicitud.direccion ||
                              "-"}
                          </p>

                          <p>
                            <strong>
                              Localidad:
                            </strong>{" "}
                            {solicitud.localidad ||
                              "-"}
                          </p>

                          <p>
                            <strong>
                              Teléfono:
                            </strong>{" "}
                            {cliente?.telefono ||
                              solicitud.cliente_telefono ||
                              "-"}
                          </p>

                          <p>
                            <strong>
                              Fecha:
                            </strong>{" "}
                            {solicitud.fecha
                              ? new Date(
                                  `${solicitud.fecha}T12:00:00`
                                ).toLocaleDateString(
                                  "es-AR"
                                )
                              : "-"}
                          </p>

                          <p>
                            <strong>
                              Horario:
                            </strong>{" "}
                            {solicitud.horario_desde ||
                              "-"}

                            {solicitud.horario_hasta
                              ? ` - ${solicitud.horario_hasta}`
                              : ""}
                          </p>

                          <p>
                            <strong>
                              Tipo:
                            </strong>{" "}
                            {solicitud.tipo_visita ||
                              "-"}
                          </p>
                        </div>

                        {/* OBSERVACIONES */}

                        {solicitud.observaciones && (
                          <div className="mt-4 rounded-lg bg-gray-50 p-4">
                            <p className="text-sm font-semibold text-gray-700">
                              Detalle de la solicitud
                            </p>

                            <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">
                              {
                                solicitud.observaciones
                              }
                            </p>
                          </div>
                        )}

                        {/* INFO FÁBRICA */}

                        {vuelveDeFabrica && (
                          <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                            <p className="font-semibold text-emerald-900">
                              Trabajo listo para instalación
                            </p>

                            <p className="mt-1 text-sm text-emerald-700">
                              Fábrica terminó el trabajo.
                              Ahora asigná un técnico
                              para realizar la colocación.
                            </p>
                          </div>
                        )}

                        {/* ASIGNADO ACTUALMENTE */}

                        {usuarioAsignado &&
                          !vuelveDeFabrica && (
                            <div className="mt-4 rounded-lg bg-blue-50 p-4">
                              <p className="text-sm font-semibold text-blue-900">
                                Asignado a
                              </p>

                              <p className="mt-1 text-sm text-blue-700">
                                {
                                  usuarioAsignado.nombre
                                }{" "}
                                {usuarioAsignado.apellido ||
                                  ""}
                                {" — "}
                                {
                                  asignacion.tipo
                                }
                              </p>
                            </div>
                          )}
                      </div>

                      {/* ========================= */}
                      {/* ASIGNACIÓN */}
                      {/* ========================= */}

                      <AsignarSolicitud
                        solicitudId={
                          solicitud.id
                        }
                        usuarios={
                          usuarios || []
                        }
                        asignacion={
                          vuelveDeFabrica
                            ? null
                            : asignacion
                        }
                      />
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </main>
    </div>
  );
}

// ==========================================
// BADGE DE ESTADO
// ==========================================

function EstadoBadge({
  estado,
}: {
  estado: string;
}) {
  const estilos: Record<
    string,
    string
  > = {
    PENDIENTE:
      "bg-amber-100 text-amber-800",

    ASIGNADO:
      "bg-blue-100 text-blue-800",

    PENDIENTE_COORDINACION:
      "bg-emerald-100 text-emerald-800",
  };

  const nombres: Record<
    string,
    string
  > = {
    PENDIENTE:
      "Pendiente",

    ASIGNADO:
      "Asignado",

    PENDIENTE_COORDINACION:
      "Pendiente de coordinación",
  };

  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-medium ${
        estilos[estado] ||
        "bg-gray-100 text-gray-700"
      }`}
    >
      {nombres[estado] || estado}
    </span>
  );
}