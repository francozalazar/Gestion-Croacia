import { notFound } from "next/navigation";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import { createClient } from "@/lib/supabase/server";
import FinalizadosLista from "@/components/finalizadosLista";
import { requierePrecio } from "@/lib/tipoVisita";

// No se llama "terminado" lo que no tiene fecha_finalizacion, ni "presupuestado" a una instalacion.
function etiquetaFinalizacion(s: any): string {
  if (s.estado === "PENDIENTE_PRECIO") return "Visita finalizada - pendiente de precio";
  if (requierePrecio(s.tipo_visita) || Number(s.subtotal || s.precio || 0) > 0) return "Presupuestado";
  if (!s.fecha_finalizacion) return "Finalizado";
  return s.solicitud_fabrica_id ? "Instalación finalizada" : "Trabajo finalizado";
}

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
    // Criterio de finalizacion registrada: el tecnico la cierra con fecha_finalizacion (el estado
    // queda PRESUPUESTADO o PENDIENTE_PRECIO segun el tipo). FINALIZADO se conserva por registros viejos.
    .or(
      "estado.eq.FINALIZADO,and(fecha_finalizacion.not.is.null,estado.in.(PRESUPUESTADO,PENDIENTE_PRECIO))"
    )
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
      etiqueta: etiquetaFinalizacion(solicitud),
    };
  });

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar
        nombre={profile.nombre}
        apellido={profile.apellido || ""}
        rol={profile.rol}
      />

      <main className="ml-0 md:ml-64 min-h-screen bg-slate-50 p-6 pt-20 md:pt-8">
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
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">
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
    </div>
  );
}
