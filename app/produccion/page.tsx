import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import ProduccionLista from "./ProduccionLista";

const estadosVisibles = [
  "ENVIADO_A_CORTAR",
  "EN_CORTE",
  "EN_FABRICACION",
  "EN_FABRICA",
  "FALTANTES",
];

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

  const rol = perfil?.rol || "OFICINA";

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
        rol={rol}
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
            <ProduccionLista trabajos={trabajos} rol={rol} />
          )}
        </div>
      </main>
    </div>
  );
}
