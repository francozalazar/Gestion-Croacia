import { redirect } from "next/navigation";

// Pagina reemplazada por /trabajos/[id]. Redirigimos por si alguien la tenia guardada.
export default async function MisTrabajoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/trabajos/${id}`);
}
