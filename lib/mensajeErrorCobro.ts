export function mensajeErrorCerrarCobro(error: string, vendedor?: string | null) {
  const detalle = error || "error inesperado";
  const errorSinSaldo = detalle.toLocaleLowerCase("es-AR");

  if (
    errorSinSaldo.includes("queda saldo pendiente") ||
    errorSinSaldo.includes("registrá el pago en clientes")
  ) {
    const nombre = vendedor?.trim();
    const instruccion = nombre
      ? `Pedile a ${nombre} que cargue el pago en Clientes.`
      : "Pedile al vendedor que cargue el pago en Clientes.";

    return `No se pudo cerrar el cobro porque todavía falta registrar el pago completo. ${instruccion} Cuando los pagos cubran el total, volvé a cerrar el cobro.`;
  }

  return `No se pudo cerrar el cobro: ${detalle}.`;
}
