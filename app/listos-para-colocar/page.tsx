import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import ListosLista from "@/components/ListosLista";

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
        
        <ListosLista solicitudes={solicitudes} error={!!error} />
      </main>
    </div>
  );
}
