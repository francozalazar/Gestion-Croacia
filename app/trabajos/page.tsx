import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import MisTrabajosVista from "@/components/MisTrabajosVista";
import Sidebar from "@/components/Sidebar";

export default async function MisTrabajosPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // Perfil y asignaciones son independientes: las pedimos en
  // paralelo para ahorrar un viaje de ida y vuelta a la base.
  const [{ data: perfil }, { data: asignaciones, error }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("nombre, apellido, rol")
        .eq("id", user.id)
        .single(),
      // Asignaciones del técnico ordenadas por prioridad
      supabase
        .from("asignaciones")
        .select("*")
        .eq("usuario_id", user.id)
        .order("prioridad", {
          ascending: true,
          nullsFirst: false,
        }),
    ]);

  if (!perfil || !["TECNICO", "FABRICA"].includes(perfil.rol)) {
    redirect("/dashboard");
  }

  let solicitudes: any[] = [];

  if (asignaciones && asignaciones.length > 0) {
    const solicitudIds = asignaciones
      .map((a) => a.solicitud_id)
      .filter(Boolean);

    const solicitudFabricaIds = asignaciones
      .map((a) => a.solicitud_fabrica_id)
      .filter(Boolean);

    const [{ data: dataBase }, { data: dataFabrica }] =
      await Promise.all([
        solicitudIds.length
          ? supabase
              .from("solicitudes")
              .select("*")
              .in("id", solicitudIds)
          : Promise.resolve({ data: [] }),

        solicitudFabricaIds.length
          ? supabase
              .from("solicitudes_fabrica")
              .select("*")
              .in("id", solicitudFabricaIds)
          : Promise.resolve({ data: [] }),
      ]);

    const estadosOcultos = [
      "FINALIZADO",
      "PRESUPUESTADO",
      "PENDIENTE_PRECIO",
      "CANCELADO",
      "LISTO_PARA_COLOCAR",
      "ANULADO",
    ];

    // Visitas cuyo pedido de fábrica fue anulado no se muestran al técnico.
    const idsFabricaVinculada = Array.from(
      new Set(
        (dataBase || [])
          .map((sol: any) => sol.solicitud_fabrica_id)
          .filter(Boolean)
      )
    );
    const fabricasAnuladas = new Set<string>();
    if (idsFabricaVinculada.length) {
      const { data: vinculadas } = await supabase
        .from("solicitudes_fabrica")
        .select("id, estado")
        .in("id", idsFabricaVinculada);
      (vinculadas || [])
        .filter((f: any) => f.estado === "ANULADO")
        .forEach((f: any) => fabricasAnuladas.add(String(f.id)));
    }

    const listaBase = (dataBase || [])
      .filter((sol) => !estadosOcultos.includes(sol.estado))
      .filter(
        (sol: any) =>
          !sol.solicitud_fabrica_id ||
          !fabricasAnuladas.has(String(sol.solicitud_fabrica_id))
      )
      .map((sol) => {
        const asig = asignaciones.find(
          (a) => String(a.solicitud_id) === String(sol.id)
        );

        return {
          ...sol,
          origen: "solicitud",
          id_unico: `sol_${sol.id}`,
          numero_visible: sol.numero || sol.id,
          prioridad: asig?.prioridad ?? 99,
          fecha_asignada: asig?.fecha || sol.fecha,
        };
      });

    const listaFabrica = (dataFabrica || [])
      .filter((sol) => !estadosOcultos.includes(sol.estado))
      .map((sol) => {
        const asig = asignaciones.find(
          (a) =>
            String(a.solicitud_fabrica_id) === String(sol.id)
        );

        return {
          ...sol,
          origen: "fabrica",
          id_unico: `fab_${sol.id}`,
          numero_visible: sol.numero_remito || sol.numero || sol.id,
          prioridad: asig?.prioridad ?? 99,
          fecha_asignada: asig?.fecha || sol.fecha,
        };
      });

    const listaCombinada = [...listaBase, ...listaFabrica].sort(
      (a, b) => a.prioridad - b.prioridad
    );

    solicitudes = listaCombinada;
  }

  const clienteIds = solicitudes
    .map((s) => s.cliente_id)
    .filter(Boolean);

  let clientes: any[] = [];

  if (clienteIds.length > 0) {
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .in("id", clienteIds);

    clientes = data || [];
  }


  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800">
      <Sidebar
        nombre={perfil.nombre}
        apellido={perfil.apellido}
        rol={perfil.rol}
      />

      <main className="ml-0 md:ml-64 flex-1 p-6 md:p-10 pt-20 md:pt-10">        <MisTrabajosVista
          solicitudes={solicitudes}
          clientes={clientes}
          error={error?.message}
          volverHref="/dashboard"
          rutaTrabajo="/trabajos"
        />
      </main>
    </div>
  );
}
