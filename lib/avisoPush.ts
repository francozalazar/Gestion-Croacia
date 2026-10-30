// Validación pura compartida por el despacho y sus pruebas. Sin datos del cliente.
export function avisoPushVigente(e: any, p: any, s: any, a: any) {
  if (!p?.activo || !s || ["ANULADO", "CANCELADO"].includes(s.estado)) return false;
  if (e.tipo === "aprobacion_pendiente") return p.rol === "ADMIN" && s.estado === "PENDIENTE_APROBACION";
  if (p.rol !== "OFICINA" || s.creado_por !== e.usuario_id) return false;
  if (e.tipo === "precio") return s.estado === "PRESUPUESTADO" && ["presupuesto", "urgencia"].includes(String(s.tipo_visita || "").trim().toLowerCase());
  if (e.tipo === "fabrica_aprobada") return !["PENDIENTE_APROBACION", "ANULADO", "CANCELADO"].includes(s.estado);
  if (e.tipo === "asignacion_vendedor") return a?.tipo === "TECNICO" && a.usuario_id === e.tecnico_id && a.fecha === e.fecha && s.fecha === e.fecha && ["ASIGNADO", "EN_PROCESO"].includes(s.estado) && !s.fecha_finalizacion;
  return false;
}
export function textoAvisoPush(tipo: string) {
  switch (tipo) {
    case "precio": return { titulo: "Croacia: trabajo tarifado", cuerpo: "Le asignaron precio a tu trabajo. Abrí la app para ver el detalle." };
    case "aprobacion_pendiente": return { titulo: "Croacia: aprobación pendiente", cuerpo: "Cargaron un trabajo de fábrica para aprobar. Abrí la app para revisarlo." };
    case "fabrica_aprobada": return { titulo: "Croacia: trabajo aprobado", cuerpo: "Tu trabajo de fábrica fue aprobado. Abrí la app para ver el detalle." };
    case "asignacion_vendedor": return { titulo: "Croacia: tu trabajo fue asignado", cuerpo: "Tu trabajo ya tiene técnico y fecha. Abrí la app para ver el detalle." };
    default: return null;
  }
}
