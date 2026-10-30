// El destinatario es quien cargó el trabajo, no quien creó al cliente.
export function avisoAsignacionVendedor(
  asignacion: any,
  visita: any,
  pedido: any,
  usuarioId: string,
  tecnico: any
) {
  const trabajo = pedido || visita;
  if (!trabajo || trabajo.creado_por !== usuarioId) return null;
  if (asignacion.tipo !== "TECNICO" || !asignacion.usuario_id || !asignacion.fecha) return null;
  if (["ANULADO", "CANCELADO", "FINALIZADO"].includes(trabajo.estado) || trabajo.fecha_finalizacion) return null;
  // No anunciar una asignación parcial cuyo paso de estado todavía no terminó.
  if (!["ASIGNADO", "EN_PROCESO"].includes(trabajo.estado)) return null;
  const fecha = String(asignacion.fecha).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
  const [ano, mes, dia] = fecha.split("-");
  const nombre = tecnico ? [tecnico.nombre, tecnico.apellido].filter(Boolean).join(" ") : "Técnico asignado";
  return {
    id: `asignacion-vendedor-${asignacion.id}-${asignacion.usuario_id}-${fecha}`,
    titulo: `Tu trabajo #${trabajo.numero_remito || trabajo.numero || trabajo.id} fue asignado`,
    detalle: `${trabajo.cliente_nombre || "Cliente"} - ${nombre} - ${dia}/${mes}/${ano}`,
    // La fecha agendada no es la fecha de la notificación.
    fecha: trabajo.updated_at || asignacion.created_at || trabajo.created_at,
    link: `/ficha/${pedido ? "remito" : "visita"}/${trabajo.id}`,
  };
}
