import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function ComprobantePage({
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

  if (
    !profile ||
    !["ADMIN", "OFICINA", "COORDINACION"].includes(profile.rol)
  ) {
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

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", solicitud.cliente_id)
    .single();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">

        <div className="mb-6 flex flex-wrap gap-3">

  <Link
    href="/finalizados"
    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
  >
    ← Volver
  </Link>

  <Link
    href={`/finalizados/${solicitud.id}/pdf`}
    className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
  >
    ↓ Descargar PDF
  </Link>

</div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">

          <div className="border-b border-slate-200 pb-6">
            <h1 className="text-3xl font-bold text-slate-900">
              Comprobante de trabajo
            </h1>

            <p className="mt-2 text-slate-500">
              Cortinas Gestión
            </p>

            <p className="mt-1 text-sm text-slate-500">
              Trabajo #{solicitud.id}
            </p>
          </div>

          {/* CLIENTE */}

          <section className="border-b border-slate-200 py-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Datos del cliente
            </h2>

            <div className="grid gap-4 md:grid-cols-2">

              <div>
                <p className="text-sm text-slate-500">
                  Nombre
                </p>

                <p className="font-semibold">
                  {cliente?.nombre || "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-slate-500">
                  Dirección
                </p>

                <p className="font-semibold">
                  {cliente?.direccion || "-"}
                </p>
              </div>

            </div>
          </section>

          {/* TRABAJO */}

          <section className="border-b border-slate-200 py-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Trabajo realizado
            </h2>

            <p className="whitespace-pre-wrap text-slate-700">
              {solicitud.trabajo_realizado || "-"}
            </p>
          </section>

          {/* OBSERVACIONES */}

          <section className="border-b border-slate-200 py-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Observaciones
            </h2>

            <p className="whitespace-pre-wrap text-slate-700">
              {solicitud.observaciones_tecnico || "-"}
            </p>
          </section>

          {/* CONFORMIDAD */}

          <section className="py-6">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Conformidad del cliente
            </h2>

            {solicitud.firma_cliente && (
              <div className="mb-5">
                <p className="mb-2 text-sm text-slate-500">
                  Firma
                </p>

                <div className="inline-block rounded-xl border border-slate-200 bg-white p-3">
                  <img
                    src={solicitud.firma_cliente}
                    alt="Firma del cliente"
                    className="h-32 w-auto"
                  />
                </div>
              </div>
            )}

            <div>
              <p className="text-sm text-slate-500">
                Aclaración
              </p>

              <p className="font-semibold">
                {solicitud.aclaracion_cliente || "-"}
              </p>
            </div>

          </section>

          {/* FECHA */}

          {solicitud.fecha_finalizacion && (
            <div className="border-t border-slate-200 pt-5 text-sm text-slate-500">
              Fecha de finalización:{" "}
              {new Date(
                solicitud.fecha_finalizacion
              ).toLocaleString("es-AR")}
            </div>
          )}

        </div>

      </div>
    </main>
  );
}