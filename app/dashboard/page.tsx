import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import {
  ClipboardList,
  Clock3,
  Wrench,
  CheckCircle2,
} from "lucide-react";

export default async function DashboardPage() {
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

  const [
    solicitudesResult,
    pendientesResult,
    procesoResult,
    finalizadosResult,
  ] = await Promise.all([
    supabase
      .from("solicitudes")
      .select("id", { count: "exact", head: true }),

    supabase
      .from("solicitudes")
      .select("id", { count: "exact", head: true })
      .eq("estado", "PENDIENTE"),

    supabase
      .from("solicitudes")
      .select("id", { count: "exact", head: true })
      .eq("estado", "EN_PROCESO"),

    supabase
      .from("solicitudes")
      .select("id", { count: "exact", head: true })
      .eq("estado", "FINALIZADO"),
  ]);

  const totalSolicitudes =
    solicitudesResult.count || 0;

  const pendientes =
    pendientesResult.count || 0;

  const enProceso =
    procesoResult.count || 0;

  const finalizados =
    finalizadosResult.count || 0;

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={profile.nombre}
        apellido={profile.apellido || ""}
        rol={profile.rol}
      />

      {/* Cambiamos ml-64 por md:ml-64 para que en mobile no deje espacio vacío, y agregamos padding superior para el header mobile */}
      <main className="md:ml-64 min-h-screen p-4 md:p-8 pt-20 md:pt-8">
        
        {/* Encabezado */}
        <div className="mb-8">
          <p className="text-sm text-slate-500">
            Bienvenido nuevamente
          </p>

          <h1 className="mt-1 text-2xl md:text-3xl font-bold text-slate-900">
            Panel principal
          </h1>
        </div>

        {/* Estadísticas */}
        <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">

          {/* Total */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Solicitudes
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {totalSolicitudes}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <ClipboardList size={24} />
              </div>
            </div>
          </div>

          {/* Pendientes */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Pendientes
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {pendientes}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <Clock3 size={24} />
              </div>
            </div>
          </div>

          {/* En proceso */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  En proceso
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {enProceso}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <Wrench size={24} />
              </div>
            </div>
          </div>

          {/* Finalizados */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">
                  Finalizados
                </p>

                <p className="mt-2 text-3xl font-bold text-slate-900">
                  {finalizados}
                </p>
              </div>

              <div className="rounded-xl bg-slate-100 p-3">
                <CheckCircle2 size={24} />
              </div>
            </div>
          </div>

        </div>

        {/* Bienvenida */}
        <div className="mt-6 rounded-2xl bg-white p-6 md:p-8 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">
            Hola, {profile.nombre} 👋
          </h2>

          <p className="mt-2 text-slate-500">
            Estás ingresando como{" "}
            <span className="font-semibold text-slate-700">
              {profile.rol}
            </span>
            .
          </p>
        </div>

      </main>
    </div>
  );
}