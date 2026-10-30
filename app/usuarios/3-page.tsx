import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import NuevoUsuarioForm from "./NuevoUsuarioForm";
import FilaUsuario from "./FilaUsuario";

export default async function UsuariosPage() {
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
  if (rol.toUpperCase() !== "ADMIN") redirect("/dashboard");

  const { data: usuarios } = await supabase
    .from("profiles")
    .select("id, nombre, apellido, rol, activo")
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={rol}
      />
      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 md:p-8 pt-20 md:pt-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Usuarios</h1>
          <p className="text-sm text-slate-600">
            Creá el acceso de una persona nueva o cambiá la contraseña de un usuario existente. Solo los administradores ven esta pantalla.
          </p>
        </div>

        <NuevoUsuarioForm />

        <div className="rounded-2xl bg-white p-6 shadow-sm max-w-xl">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Usuarios actuales</h2>
          <ul className="divide-y divide-slate-100">
            {(usuarios || []).map((u: any) => (
              <FilaUsuario key={u.id} u={u} />
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
