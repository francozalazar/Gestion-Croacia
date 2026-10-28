// Anula visitas (tabla solicitudes). Algunas bases solo admiten CANCELADO como
// estado de baja en solicitudes: si ANULADO viola el check, se usa CANCELADO.
// Nunca toca visitas FINALIZADAS.
export async function anularVisitas(
  supabase: any,
  columna: "id" | "solicitud_fabrica_id",
  valor: number
): Promise<{ message: string } | null> {
  let r = await supabase
    .from("solicitudes")
    .update({ estado: "ANULADO" })
    .eq(columna, valor)
    .neq("estado", "FINALIZADO");
  if (r.error && r.error.code === "23514") {
    r = await supabase
      .from("solicitudes")
      .update({ estado: "CANCELADO" })
      .eq(columna, valor)
      .neq("estado", "FINALIZADO");
  }
  return r.error || null;
}
