// Anula visitas (tabla solicitudes). Verificado en producción (28/10/2026): el check
// de solicitudes.estado rechaza ANULADO y admite CANCELADO como estado de baja.
// Nunca toca visitas FINALIZADAS.
export async function anularVisitas(
  supabase: any,
  columna: "id" | "solicitud_fabrica_id",
  valor: number
): Promise<{ message: string } | null> {
  const r = await supabase
    .from("solicitudes")
    .update({ estado: "CANCELADO" })
    .eq(columna, valor)
    .neq("estado", "FINALIZADO");
  return r.error || null;
}
