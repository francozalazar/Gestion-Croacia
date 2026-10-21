import { notFound } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import TrabajosFinalizadosLista, {
  type TrabajoInstalado,
} from "@/components/TrabajosFinalizadosLista";

// Cierre del circuito: pedido de fabrica -> corte -> listo para colocar ->
// coordinacion -> el tecnico instalo y finalizo. Solo lee, no modifica nada.
export default async function TrabajosFinalizadosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "OFICINA", "COORDINACION"].includes(profile.rol)) {
    notFound();
  }

  // Visitas ligadas a un pedido de fabrica que el tecnico ya finalizo.
  const { data: visitas } = await supabase
    .from("solicitudes")
    .select("id, solicitud_fabrica_id, cliente_nombre, direccion, localidad, estado, fecha_finalizacion")
    .not("solicitud_fabrica_id", "is", null)
    .not("fecha_finalizacion", "is", null)
    .in("estado", ["FINALIZADO", "PENDIENTE_PRECIO", "PRESUPUESTADO"])
    .order("fecha_finalizacion", { ascending: false });

  const lista = visitas || [];
  const pedidoIds = [...new Set(lista.map((v) => v.solicitud_fabrica_id))];

  let pedidos: any[] = [];
  if (pedidoIds.length > 0) {
    const { data } = await supabase
      .from("solicitudes_fabrica")
      .select("id, numero_remito, cliente_nombre, creado_por")
      .in("id", pedidoIds);
    pedidos = data || [];
  }

  const solicitudIds = lista.map((v) => v.id);
  let asignaciones: any[] = [];
  if (solicitudIds.length > 0) {
    const { data } = await supabase
      .from("asignaciones")
      .select("solicitud_id, profiles(nombre, apellido)")
      .in("solicitud_id", solicitudIds);
    asignaciones = data || [];
  }

  // OFICINA ve solo los pedidos que cargo ella (creado_por del pedido de fabrica,
  // no de la visita, que la crea quien aprueba). ADMIN y COORDINACION ven todos.
  const trabajos: TrabajoInstalado[] = lista
    .map((v) => {
      const pedido = pedidos.find((p) => p.id === v.solicitud_fabrica_id);
      const asig = asignaciones.find((a) => a.solicitud_id === v.id);
      const tec = asig?.profiles as any;
      return {
        id: v.id,
        pedido: pedido?.numero_remito ?? v.solicitud_fabrica_id,
        cliente: pedido?.cliente_nombre || v.cliente_nombre || "Sin cliente",
        direccion: [v.direccion, v.localidad].filter(Boolean).join(" - "),
        fechaInstalacion: v.fecha_finalizacion as string | null,
        tecnico: tec ? [tec.nombre, tec.apellido].filter(Boolean).join(" ") : "",
        creadoPor: pedido?.creado_por as string | undefined,
      };
    })
    .filter((t) => profile.rol !== "OFICINA" || t.creadoPor === user.id)
    .map(({ creadoPor, ...resto }) => resto);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={profile.nombre}
        apellido={profile.apellido || ""}
        rol={profile.rol}
      />
      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-4 pt-20 md:p-8 md:pt-8">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/dashboard"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Volver al inicio
          </Link>
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Trabajos finalizados
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Pedidos de fábrica que el técnico ya instaló. El remito es el comprobante del técnico.
            </p>
            {profile.rol === "OFICINA" && (
              <p className="mt-2 inline-block border border-blue-100 bg-blue-50 px-3 py-1.5 text-sm text-blue-700">
                Mostrando los pedidos cargados por vos.
              </p>
            )}
          </div>
          <TrabajosFinalizadosLista trabajos={trabajos} />
        </div>
      </main>
    </div>
  );
}
