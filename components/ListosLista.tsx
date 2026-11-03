import { createClient } from "@/lib/supabase/server";
import ListosVista from "@/components/ListosVista";

// Lista de pedidos terminados por fabrica, listos para coordinar la instalacion.
export default async function ListosLista({ solicitudes, error }: { solicitudes: any[] | null; error?: boolean }) {
  // La autoria es la carga original del pedido, nunca su aprobacion.
  const idsCreadores = [...new Set((solicitudes || []).map((s) => s.creado_por).filter(Boolean))];
  const nombresCreadores: Record<string, string> = {};
  if (idsCreadores.length > 0) {
    const supabase = await createClient();
    const { data: creadores } = await supabase
      .from("profiles")
      .select("id, nombre, apellido")
      .in("id", idsCreadores);
    for (const creador of creadores || []) {
      const nombre = [creador.nombre, creador.apellido].filter(Boolean).join(" ").trim();
      if (nombre) nombresCreadores[creador.id] = nombre;
    }
  }

  return (
    <ListosVista
      solicitudes={solicitudes}
      error={error}
      nombresCreadores={nombresCreadores}
      volverHref="/dashboard"
    />
  );
}
