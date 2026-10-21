import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import EnviarACoordinacion from "@/components/EnviarACoordinacion";
import Link from "next/link";
import {
  Factory,
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

  // Consulta directa a la tabla de fábrica donde se guardan los cortes terminados
  const { data: solicitudes, error } = await supabase
    .from("solicitudes_fabrica")
    .select("*")
    .in("estado", ["LISTO_INSTALACION", "LISTO_PARA_COLOCAR"])
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

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
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
            <div className="rounded-xl bg-white p-12 text-center shadow-sm">
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

        {solicitudes && solicitudes.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="hidden grid-cols-[90px_1.2fr_1.4fr_110px_auto] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase text-slate-500 md:grid">
              <span>Pedido</span>
              <span>Cliente</span>
              <span>Dirección</span>
              <span>Fecha</span>
              <span className="text-right">Acción</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {solicitudes.map((solicitud) => (
                <li
                  key={solicitud.id}
                  className="grid gap-2 px-5 py-4 text-sm md:grid-cols-[90px_1.2fr_1.4fr_110px_auto] md:items-center md:gap-4"
                >
                  <span className="font-bold text-slate-900">
                    <span className="md:hidden text-xs font-medium text-slate-400">Pedido </span>
                    #{solicitud.numero_remito}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-800">
                      {solicitud.cliente_nombre || "-"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {solicitud.tipo_visita || "Sin tipo especificado"}
                      {solicitud.cliente_telefono ? ` - ${solicitud.cliente_telefono}` : ""}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-slate-700">
                      {solicitud.direccion || "-"}
                      {solicitud.localidad ? ` - ${solicitud.localidad}` : ""}
                    </p>
                    {solicitud.observaciones && (
                      <p className="line-clamp-2 text-xs text-slate-500">
                        {solicitud.observaciones}
                      </p>
                    )}
                  </div>
                  <span className="text-slate-700">
                    <span className="md:hidden text-xs text-slate-400">Fecha solicitada: </span>
                    {solicitud.fecha
                      ? new Date(`${solicitud.fecha}T12:00:00`).toLocaleDateString("es-AR")
                      : "-"}
                  </span>
                  <div className="md:text-right">
                    <EnviarACoordinacion solicitud={solicitud} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </div>
  );
}
