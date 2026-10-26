import { createClient } from "@/lib/supabase/server";
import { textoFranja } from "@/lib/franjas";
import { redirect, notFound } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import CompletarTrabajo from "@/components/CompletarTrabajo";
import Link from "next/link";

export default async function TrabajoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ origen?: string }>;
}) {
  const { id } = await params;
  const { origen } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // =========================
  // PERFIL
  // =========================

  const { data: perfil } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!perfil || !["ENCARGADO"].includes(perfil.rol)) {
    redirect("/dashboard");
  }

  const solicitudId = Number(id);

  if (Number.isNaN(solicitudId)) {
    notFound();
  }

  const esFabrica = origen === "fabrica";

  // Vista normalizada para renderizar igual ambos origenes
  let vista: {
    id: number;
    numero: string | number;
    solicitudPrincipalId: number | null;
    estado: string;
    cliente_nombre: string | null;
    cliente_telefono: string | null;
    direccion: string | null;
    localidad: string | null;
    fecha: string | null;
    horario_desde: string | null;
    horario_hasta: string | null;
    tipo_visita: string | null;
    observaciones: string | null;
    trabajo_realizado: string | null;
    observaciones_tecnico: string | null;
    firma_cliente: string | null;
    aclaracion_cliente: string | null;
    tecnico_remito: string | null;
    ayudante: string | null;
  };

  const { data: propio, error } = await supabase.rpc("encargado_trabajo", {
    p_id: solicitudId,
    p_fabrica: esFabrica,
  });
  if (error || !propio) notFound();
  vista = propio;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido}
        rol={perfil.rol}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 md:p-8 pt-20 md:pt-8">
        {/* ENCABEZADO */}

        <div className="mb-6">
          <Link
            href="/encargado"
            className="mb-4 inline-block text-sm font-medium text-slate-500 hover:text-slate-900"
          >
            ← Volver a mis trabajos
          </Link>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-slate-900 px-3 py-1 text-sm font-bold text-white">
                  #{vista.numero}
                </span>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                  {vista.estado}
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
                Detalle del trabajo
              </h1>
            </div>
          </div>
        </div>

        {/* DATOS DEL CLIENTE */}

        <div className="mb-6 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-5 text-xl font-bold text-slate-900">
            Datos del cliente
          </h2>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Cliente
              </p>

              <p className="mt-1 text-base font-medium text-slate-900">
                {vista.cliente_nombre || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Teléfono
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.cliente_telefono || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Dirección
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.direccion || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Localidad
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.localidad || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Fecha
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.fecha || "-"}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">
                Horario
              </p>

              <p className="mt-1 text-base text-slate-700">
                {vista.horario_desde || vista.horario_hasta
                  ? textoFranja(vista.horario_desde, vista.horario_hasta)
                  : "-"}
              </p>
            </div>
          </div>
        </div>

        {/* TRABAJO SOLICITADO */}

        <div className="mb-6 rounded-xl bg-white p-6 shadow">
          <h2 className="mb-4 text-xl font-bold text-slate-900">
            Trabajo solicitado
          </h2>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm font-semibold text-slate-500">
              Tipo de visita
            </p>

            <p className="mt-1 text-lg font-semibold text-slate-900">
              {vista.tipo_visita || "No especificado"}
            </p>

            {vista.observaciones && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-slate-500">
                  Indicaciones de oficina
                </p>

                <p className="mt-1 whitespace-pre-wrap text-slate-700">
                  {vista.observaciones}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* COMPLETAR */}

        <CompletarTrabajo
          solicitudId={vista.id}
          solicitudPrincipalId={vista.solicitudPrincipalId}
          estado={vista.estado}
          trabajoRealizado={vista.trabajo_realizado}
          observacionesTecnico={vista.observaciones_tecnico}
          firmaCliente={vista.firma_cliente}
          aclaracionCliente={vista.aclaracion_cliente}
          tecnicoInicial={
            vista.tecnico_remito ||
            `${perfil.nombre || ""} ${perfil.apellido || ""}`.trim()
          }
          ayudanteInicial={vista.ayudante}
          tipoVisita={vista.tipo_visita}
          esFabrica={esFabrica}
        />
      </main>
    </div>
  );
}
