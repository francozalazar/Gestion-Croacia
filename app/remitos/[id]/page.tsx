import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";

function plata(n: any) {
  if (n === null || n === undefined || n === "") return "-";
  return "$ " + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

function fecha(f: string | null) {
  if (!f) return "-";
  return new Date(`${f}T12:00:00`).toLocaleDateString("es-AR");
}

export default async function RemitoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const remitoId = Number(id);
  if (!remitoId) notFound();

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

  const { data: remito } = await supabase
    .from("solicitudes_fabrica")
    .select("*")
    .eq("id", remitoId)
    .single();

  if (!remito) notFound();

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={perfil?.nombre || "Usuario"}
        apellido={perfil?.apellido || ""}
        rol={perfil?.rol || "OFICINA"}
      />

      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 md:p-8 pt-20 md:pt-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="javascript:history.back()"
            className="text-sm text-slate-500 hover:text-slate-800"
          >
            ← Volver
          </Link>

          <div className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Remito #{remito.numero_remito || remito.id}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {remito.cliente_nombre || "Cliente sin nombre"}
              </p>
            </div>
            <a
              href={`/remitos/${remito.id}/pdf`}
              target="_blank"
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Descargar PDF
            </a>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="grid gap-4 text-sm md:grid-cols-2">
              <p className="text-slate-600">
                <strong className="text-slate-900">Estado:</strong>{" "}
                {(remito.estado || "-").replaceAll("_", " ")}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Fecha:</strong>{" "}
                {fecha(remito.fecha)}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Dirección:</strong>{" "}
                {remito.direccion || "-"}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Localidad:</strong>{" "}
                {remito.localidad || "-"}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Horario:</strong>{" "}
                {remito.horario_desde && remito.horario_hasta
                  ? `${remito.horario_desde} a ${remito.horario_hasta}`
                  : "-"}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Tipo:</strong>{" "}
                {remito.tipo_visita || "-"}
              </p>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <h2 className="text-sm font-bold text-slate-900">
                Detalle del trabajo
              </h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {remito.observaciones || "Sin detalle cargado."}
              </p>
            </div>

            <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 text-sm md:grid-cols-2">
              <p className="text-slate-600">
                <strong className="text-slate-900">Total:</strong>{" "}
                {plata(remito.total_pesos)}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Seña:</strong>{" "}
                {plata(remito.sena_pesos)}
                {remito.sena_porcentaje ? ` (${remito.sena_porcentaje}%)` : ""}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Saldo:</strong>{" "}
                {plata(remito.saldo_restante)}
              </p>
              <p className="text-slate-600">
                <strong className="text-slate-900">Medio de pago:</strong>{" "}
                {remito.medio_pago || "-"}
                {remito.aclaracion_pago ? ` — ${remito.aclaracion_pago}` : ""}
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
