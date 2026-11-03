import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import ProduccionVista from "@/components/ProduccionVista";

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
        <ProduccionVista trabajos={trabajos || []} rol={rol} />
      </main>
    </div>
  );
}
