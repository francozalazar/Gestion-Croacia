import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import { anularProduccionAction } from "./actions";

const estadosVisibles = [
  "ENVIADO_A_CORTAR",
  "EN_CORTE",
  "EN_FABRICACION",
  "EN_FABRICA",
  "FALTANTES",
  "LISTO_INSTALACION",
  "ANULADO",
];

function textoEstado(estado: string) {
  const estados: Record<string, string> = {
    ENVIADO_A_CORTAR: "Pendiente de producción",
    EN_CORTE: "En corte",
    EN_FABRICACION: "En proceso",
    EN_FABRICA: "En proceso",
    FALTANTES: "Faltantes",
    LISTO_INSTALACION: "Terminado",
    ANULADO: "Anulado",
  };

  return estados[estado] || estado;
}

export default async function ProduccionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  const rol = perfil?.rol?.toUpperCase();

  if (!["ADMIN", "OFICINA"].includes(rol || "")) {
    redirect("/dashboard");
  }

  const { data: trabajos, error } = await supabase
    .from("solicitudes_fabrica")
    .select("*")
    .in("estado", estadosVisibles)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="p-8">
        <p className="text-red-600">
          Error al cargar producción: {error.message}
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 md:p-8 pt-20 md:pt-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Producción</h1>
            <p className="mt-1 text-sm text-slate-500">
              Estado de los trabajos enviados a fábrica.
            </p>
          </div>

          {!trabajos?.length ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No hay trabajos de fábrica.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {trabajos.map((trabajo) => {
                const esAnulado = trabajo.estado === "ANULADO";

                return (
                  <article
                    key={trabajo.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-slate-900">
                          {trabajo.cliente_nombre || trabajo.cliente || "Cliente sin nombre"}
                        </h2>
                        <p className="text-xs text-slate-500">
                          Remito #{trabajo.numero_remito || trabajo.id}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          esAnulado
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {textoEstado(trabajo.estado)}
                      </span>
                    </div>

                    <div className="mt-5 space-y-2 text-sm text-slate-600">
                      <p>
                        <strong>Solicitud creada:</strong>{" "}
                        {trabajo.created_at
                          ? new Date(trabajo.created_at).toLocaleDateString(
                              "es-AR"
                            )
                          : "-"}
                      </p>
                      <p>
                        <strong>Finalización estimada:</strong>{" "}
                        {trabajo.fecha || "-"}
                      </p>
                      <p>
                        <strong>Dirección:</strong>{" "}
                        {trabajo.direccion || "-"}
                      </p>
                      <p>
                        <strong>Localidad:</strong>{" "}
                        {trabajo.localidad || "-"}
                      </p>
                    </div>

                    {rol === "ADMIN" && !esAnulado && (
                      <form action={anularProduccionAction} className="mt-5">
                        <input
                          type="hidden"
                          name="id"
                          value={trabajo.id}
                        />
                        <button
                          type="submit"
                          className="w-full rounded-xl bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"
                        >
                          Anular
                        </button>
                      </form>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
