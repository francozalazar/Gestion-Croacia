import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CompletarTrabajo from "@/components/CompletarTrabajo";

export default async function TrabajoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const solicitudId = Number(id);

  if (!solicitudId) {
    notFound();
  }

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

  if (!profile || !["TECNICO", "FABRICA"].includes(profile.rol)) {
    notFound();
  }

  const { data: asignacion } = await supabase
    .from("asignaciones")
    .select("*")
    .eq("solicitud_id", solicitudId)
    .eq("usuario_id", user.id)
    .single();

  if (!asignacion) {
    notFound();
  }

  const { data: solicitud } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("id", solicitudId)
    .single();

  if (!solicitud) {
    notFound();
  }

  let cliente = null;

  if (solicitud.cliente_id) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", solicitud.cliente_id)
      .single();

    cliente = data;
  }

  const finalizado = solicitud.estado === "FINALIZADO";

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/mis-trabajos"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Volver a mis trabajos
        </Link>

        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            Trabajo #{solicitud.id}
          </h1>

          <p className="mt-1 text-slate-500">
            {finalizado ? "Trabajo finalizado" : "Trabajo pendiente"}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-slate-900">
              Datos del trabajo
            </h2>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-slate-500">Cliente</p>
                <p className="font-semibold text-slate-900">
                  {cliente?.nombre || "Sin cliente"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Dirección</p>
                <p className="font-semibold text-slate-900">
                  {cliente?.direccion || "Sin dirección"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">Trabajo solicitado</p>
                <p className="whitespace-pre-wrap text-slate-900">
                  {solicitud.observaciones || "Sin observaciones"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-slate-900">
              Completar trabajo
            </h2>

            <CompletarTrabajo
              solicitudId={solicitud.id}
              trabajoRealizado={solicitud.trabajo_realizado || ""}
              observacionesTecnico={solicitud.observaciones_tecnico || ""}
              firmaCliente={solicitud.firma_cliente || ""}
              aclaracionCliente={solicitud.aclaracion_cliente || ""}
              estado={solicitud.estado}
            />
          </section>
        </div>
      </div>
    </main>
  );
}