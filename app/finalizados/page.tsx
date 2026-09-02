import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

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

  const { data: solicitudes, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("estado", "FINALIZADO")
    .order("fecha_finalizacion", {
      ascending: false,
    });

  if (error) {
    console.error(error);
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

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            Trabajos finalizados
          </h1>

          <p className="mt-2 text-slate-500">
            Trabajos realizados y enviados por los técnicos.
          </p>
        </div>

        {solicitudesFinalizadas.length === 0 ? (
          <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-700">
              No hay trabajos finalizados
            </p>

            <p className="mt-2 text-sm text-slate-500">
              Cuando un técnico termine un trabajo,
              aparecerá acá.
            </p>
          </div>
        ) : (
          <div className="space-y-4">

            {solicitudesFinalizadas.map((solicitud) => {
              const cliente = clientes.find(
                (c) => c.id === solicitud.cliente_id
              );

              return (
                <div
                  key={solicitud.id}
                  className="rounded-2xl bg-white p-6 shadow-sm"
                >

                  <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center">

                    <div className="space-y-3">

                      <div className="flex items-center gap-3">
                        <h2 className="text-lg font-bold text-slate-900">
                          Trabajo #{solicitud.id}
                        </h2>

                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                          FINALIZADO
                        </span>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">
                          Cliente
                        </p>

                        <p className="font-semibold text-slate-900">
                          {cliente?.nombre || "Sin cliente"}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-slate-500">
                          Trabajo realizado
                        </p>

                        <p className="max-w-2xl whitespace-pre-wrap text-sm text-slate-700">
                          {solicitud.trabajo_realizado ||
                            "Sin detalle"}
                        </p>
                      </div>

                      {solicitud.fecha_finalizacion && (
                        <p className="text-xs text-slate-500">
                          Finalizado:{" "}
                          {new Date(
                            solicitud.fecha_finalizacion
                          ).toLocaleString("es-AR")}
                        </p>
                      )}

                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row">

                      <Link
                        href={`/mis-trabajos/${solicitud.id}`}
                        className="rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Ver trabajo
                      </Link>

                      <Link
                        href={`/finalizados/${solicitud.id}`}
                        className="rounded-xl bg-slate-900 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
                      >
                        Ver comprobante
                      </Link>

                    </div>

                  </div>

                </div>
              );
            })}

          </div>
        )}

      </div>
    </main>
  );
}