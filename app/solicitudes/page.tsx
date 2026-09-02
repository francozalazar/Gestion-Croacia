import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import { Plus, ClipboardList } from "lucide-react";

export default async function SolicitudesPage() {
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

  const rolesPermitidos = [
    "ADMIN",
    "OFICINA",
    "COORDINACION",
  ];

  if (!profile || !rolesPermitidos.includes(profile.rol)) {
    redirect("/dashboard");
  }

  const { data: solicitudes, error } = await supabase
    .from("solicitudes")
    .select(`
      id,
      numero,
      direccion,
      localidad,
      fecha,
      horario_desde,
      horario_hasta,
      tipo_visita,
      estado,
      observaciones,
      clientes (
        nombre,
        telefono
      )
    `)
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
        
        {/* Encabezado */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">
              Gestión de trabajos
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              Solicitudes
            </h1>
          </div>

          {["ADMIN", "OFICINA"].includes(profile.rol) && (
            <Link
              href="/solicitudes/nueva"
              className="flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus size={18} />
              Nueva solicitud
            </Link>
          )}
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
          
          <div className="border-b border-slate-200 p-5">
            <div className="flex items-center gap-3">
              <ClipboardList
                size={20}
                className="text-slate-500"
              />

              <h2 className="font-semibold text-slate-900">
                Solicitudes registradas
              </h2>
            </div>
          </div>

          {error ? (
            <div className="p-6 text-sm text-red-600">
              No se pudieron cargar las solicitudes.
            </div>
          ) : !solicitudes || solicitudes.length === 0 ? (
            <div className="p-12 text-center">
              <ClipboardList
                size={42}
                className="mx-auto text-slate-300"
              />

              <h3 className="mt-4 font-semibold text-slate-900">
                No hay solicitudes
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Todavía no se creó ninguna solicitud de trabajo.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left">
                    <th className="px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Nº
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Cliente
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Dirección
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Fecha
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Tipo
                    </th>

                    <th className="px-5 py-4 text-xs font-semibold uppercase text-slate-500">
                      Estado
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {solicitudes.map((solicitud) => {
                    const cliente = Array.isArray(solicitud.clientes)
                      ? solicitud.clientes[0]
                      : solicitud.clientes;

                    return (
                      <tr
                        key={solicitud.id}
                        className="border-b border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-4">
                          <span className="font-semibold text-slate-900">
                            #{String(solicitud.numero).padStart(5, "0")}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-medium text-slate-900">
                            {cliente?.nombre || "-"}
                          </p>

                          {cliente?.telefono && (
                            <p className="text-xs text-slate-500">
                              {cliente.telefono}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">
                            {solicitud.direccion}
                          </p>

                          {solicitud.localidad && (
                            <p className="text-xs text-slate-500">
                              {solicitud.localidad}
                            </p>
                          )}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {new Date(
                            solicitud.fecha + "T00:00:00"
                          ).toLocaleDateString("es-AR")}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {solicitud.tipo_visita}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              solicitud.estado === "PENDIENTE"
                                ? "bg-amber-100 text-amber-700"
                                : solicitud.estado === "ASIGNADO"
                                ? "bg-blue-100 text-blue-700"
                                : solicitud.estado === "EN_PROCESO"
                                ? "bg-purple-100 text-purple-700"
                                : solicitud.estado === "FINALIZADO"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {solicitud.estado.replace("_", " ")}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}