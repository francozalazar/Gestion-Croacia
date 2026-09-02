import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import FinalizadosLista from "@/components/finalizadosLista";

export default async function FinalizadosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["ADMIN", "OFICINA", "COORDINACION"].includes(profile.rol)
  ) {
    notFound();
  }

  // ADMIN y COORDINACIÓN ven todos.
  // OFICINA solamente ve los trabajos que ella misma cargó.
  let query = supabase
    .from("solicitudes")
    .select("*")
    .eq("estado", "FINALIZADO")
    .order("fecha_finalizacion", {
      ascending: false,
    });

  if (profile.rol === "OFICINA") {
    query = query.eq("creado_por", user.id);
  }

  const { data: solicitudes, error } = await query;

  if (error) {
    console.error("Error al cargar trabajos finalizados:", error);
  }

  const solicitudesFinalizadas = solicitudes || [];

  const clienteIds = [
    ...new Set(
      solicitudesFinalizadas
        .map((s) => s.cliente_id)
        .filter(Boolean)
    ),
  ];

  let clientes: any[] = [];

  if (clienteIds.length > 0) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .in("id", clienteIds);

    clientes = data || [];
  }

  const trabajos = solicitudesFinalizadas.map((solicitud) => {
    const cliente = clientes.find(
      (c) => c.id === solicitud.cliente_id
    );

    return {
      id: solicitud.id,
      numero: solicitud.numero,
      clienteNombre:
        cliente?.nombre ||
        solicitud.cliente_nombre ||
        "Sin cliente",
      direccion: solicitud.direccion || "",
      localidad: solicitud.localidad || "",
      trabajoRealizado: solicitud.trabajo_realizado || "",
      fechaFinalizacion: solicitud.fecha_finalizacion || null,
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        {/* VOLVER */}
        <Link
          href="/dashboard"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          ← Volver al inicio
        </Link>

        {/* ENCABEZADO */}
        <div className="mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                Trabajos finalizados
              </h1>

              <p className="mt-2 text-slate-500">
                Trabajos realizados y enviados por los técnicos.
              </p>
            </div>

            {profile.rol === "OFICINA" && (
              <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">
                Mostrando los trabajos cargados por vos.
              </div>
            )}
          </div>
        </div>

        <FinalizadosLista trabajos={trabajos} />

      </div>
    </main>
  );
}