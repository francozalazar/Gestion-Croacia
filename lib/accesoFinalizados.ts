export async function puedeVerFinalizado(supabase: any, userId: string, rol: string, solicitud: any) {
  if (rol !== "OFICINA" || !solicitud.solicitud_fabrica_id || !solicitud.fecha_finalizacion) return true;
  const { data } = await supabase.from("clientes").select("id").eq("id", solicitud.cliente_id).eq("creado_por", userId).maybeSingle();
  return !!data;
}
