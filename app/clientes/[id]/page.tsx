import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import ClienteFicha from "./ClienteFicha";

export default async function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clienteId = Number(id);
  if (!clienteId) redirect("/clientes");

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

  const { data: cliente } = await supabase
    .from("clientes")
    .select("id, nombre, telefono, email, direccion, localidad, creado_por, created_at")
    .eq("id", clienteId)
    .single();

  if (!cliente) redirect("/clientes");

  if (!esAdmin && cliente.creado_por && cliente.creado_por !== user.id) {
    redirect("/clientes");
  }

  const { data: direcciones } = await supabase
    .from("direcciones")
    .select("id, direccion, localidad")
    .eq("cliente_id", clienteId)
    .order("created_at");

  const { data: ventas } = await supabase
    .from("ventas")
    .select("id, direccion_id, descripcion, total, created_at, pagos(id, monto, fecha, medio, facturado, factura_url)")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  const { data: solicitudes } = await supabase
    .from("solicitudes")
    .select("id, numero, direccion, localidad, fecha, estado, tipo_visita, observaciones, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  const { data: remitosVinculados } = await supabase
    .from("solicitudes_fabrica")
    .select("id, numero_remito, direccion, localidad, fecha, estado, observaciones, created_at")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false });

  const { data: remitosPorNombre } = await supabase
    .from("solicitudes_fabrica")
    .select("id, numero_remito, direccion, localidad, fecha, estado, observaciones, created_at")
    .is("cliente_id", null)
    .ilike("cliente_nombre", cliente.nombre)
    .order("created_at", { ascending: false });

  const remitos = [...(remitosVinculados || []), ...(remitosPorNombre || [])]
    .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={rol}
      />

      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 md:p-8 pt-20 md:pt-8">
        <ClienteFicha
          cliente={cliente}
          direcciones={direcciones || []}
          ventas={ventas || []}
          solicitudes={solicitudes || []}
          remitos={remitos}
        />
      </main>
    </div>
  );
}
