import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import PanelEncargado from "./PanelEncargado";
export default async function EncargadoPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  const { seccion } = await searchParams;
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/");
  const { data: perfil } = await db
    .from("profiles")
    .select("nombre,apellido,rol,activo")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "ENCARGADO" || !perfil.activo) redirect("/dashboard");
  const { data, error } = await db.rpc("encargado_datos");
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido || ""}
        rol={perfil.rol}
      />
      <main className="md:ml-64 p-5 pt-20 md:p-10">
        <h1 className="text-2xl font-bold">Operaciones</h1>
        <p className="mt-2 mb-6 text-slate-600">
          Coordinación, recorridos, producción, motores y tus remitos asignados.
        </p>
        {error ? (
          <p role="alert">
            No se pudo cargar el panel operativo. Probá de nuevo.
          </p>
        ) : (
          <PanelEncargado datos={data} usuarioId={user.id} seccion={seccion} />
        )}
      </main>
    </div>
  );
}
