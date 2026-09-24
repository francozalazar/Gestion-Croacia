// Lista única de estados usados por la app.
// Si agregás un estado nuevo, agregalo acá y usalo desde acá,
// así no quedan nombres distintos en cada pantalla.

// Tabla `solicitudes` (visitas / trabajos de instalación)
export const ESTADO_SOLICITUD = {
  PENDIENTE: "PENDIENTE",
  ASIGNADO: "ASIGNADO",
  ASIGNADO_FABRICA: "ASIGNADO_FABRICA", // en fábrica, todavía no está listo
  LISTO_PARA_COLOCAR: "LISTO_PARA_COLOCAR", // fábrica terminó, espera que Oficina lo mande a Coordinación
  PENDIENTE_COORDINACION: "PENDIENTE_COORDINACION",
  FINALIZADO: "FINALIZADO",
} as const;

// Tabla `solicitudes_fabrica` (remitos de fábrica)
export const ESTADO_FABRICA = {
  PENDIENTE_APROBACION: "PENDIENTE_APROBACION",
  EN_CORTE: "EN_CORTE",
  EN_FABRICACION: "EN_FABRICACION",
  FALTANTES: "FALTANTES",
  LISTO_PARA_COLOCAR: "LISTO_PARA_COLOCAR", // antes se guardaba como "LISTO_INSTALACION"
  ENVIADO_COORDINACION: "ENVIADO_COORDINACION",
  FINALIZADO: "FINALIZADO",
} as const;

// Estados que cuentan como "En proceso" en el tablero:
// todo lo que ya arrancó y todavía no está finalizado.
export const ESTADOS_EN_PROCESO: string[] = [
  ESTADO_SOLICITUD.ASIGNADO,
  ESTADO_SOLICITUD.ASIGNADO_FABRICA,
  ESTADO_SOLICITUD.LISTO_PARA_COLOCAR,
  ESTADO_SOLICITUD.PENDIENTE_COORDINACION,
];

export const NOMBRE_ESTADO: Record<string, string> = {
  PENDIENTE: "Pendiente",
  ASIGNADO: "Asignado",
  ASIGNADO_FABRICA: "En fábrica",
  LISTO_PARA_COLOCAR: "Listo para colocar",
  PENDIENTE_COORDINACION: "Pendiente de coordinación",
  ENVIADO_COORDINACION: "Enviado a coordinación",
  PENDIENTE_APROBACION: "Pendiente de aprobación",
  EN_CORTE: "En corte",
  EN_FABRICACION: "En fabricación",
  FALTANTES: "Con faltantes",
  FINALIZADO: "Finalizado",
};

export const COLOR_ESTADO: Record<string, string> = {
  PENDIENTE: "bg-amber-100 text-amber-700",
  ASIGNADO: "bg-blue-100 text-blue-700",
  ASIGNADO_FABRICA: "bg-indigo-100 text-indigo-700",
  LISTO_PARA_COLOCAR: "bg-teal-100 text-teal-700",
  PENDIENTE_COORDINACION: "bg-emerald-100 text-emerald-700",
  FINALIZADO: "bg-green-100 text-green-700",
};

export function nombreEstado(estado: string | null | undefined) {
  if (!estado) return "-";
  return NOMBRE_ESTADO[estado] || estado.replaceAll("_", " ");
}
