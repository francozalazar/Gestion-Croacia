import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import ClientesLista from "./ClientesLista";

export default async function ClientesPage() {
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
  const esAdmin = rol.toUpperCase() === "ADMIN";

  let query = supabase
    .from("clientes")
    .select("id, nombre, direccion, localidad, creado_por, created_at")
    .order("nombre");

  if (!esAdmin) {
    query = query.or(`creado_por.eq.${user.id},creado_por.is.null`);
  }

  const { data: clientes } = await query;

  const { data: ventas } = await supabase
    .from("ventas")
    .select("id, cliente_id, total, pagos(monto)");

  const deudaPorCliente: Record<number, number> = {};
  (ventas || []).forEach((v: any) => {
    const pagado = (v.pagos || []).reduce(
      (acc: number, p: any) => acc + Number(p.monto || 0),
      0
    );
    const falta = Number(v.total || 0) - pagado;
    deudaPorCliente[v.cliente_id] =
      (deudaPorCliente[v.cliente_id] || 0) + falta;
  });

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={rol}
      />

      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 md:p-8 pt-20 md:pt-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">
              {esAdmin ? "Clientes" : "Mis clientes"}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Historial, ventas y pagos de cada cliente.
            </p>
          </div>

          <ClientesLista
            clientes={clientes || []}
            deudaPorCliente={deudaPorCliente}
          />
        </div>
      </main>
    </div>
  );
}
