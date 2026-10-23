// Alta idempotente de venta + pago inicial ("cuanto abono y como").
// La clave la genera el cliente por intento de alta y NO se regenera hasta
// el exito: un retry (timeout, error de red, doble submit) repite la misma
// clave y el servidor reutiliza la fila ya creada en vez de duplicarla.
// Seguridad: una clave existente solo se reutiliza si pertenece al mismo
// usuario, mismo cliente y mismos importes; si no, se rechaza.

type SupabaseLike = any;

export class ConflictoIdempotencia extends Error {}

export async function crearVentaIdempotente(
  supabase: SupabaseLike,
  fila: Record<string, any>,
  idemKey: string | null,
  esperado: { cliente_id: number; creado_por: string; total: number }
): Promise<number> {
  if (idemKey) {
    const { data: prev } = await supabase
      .from("ventas")
      .select("id, cliente_id, creado_por, total")
      .eq("idempotencia_key", idemKey)
      .maybeSingle();
    if (prev) {
      // Retry legitimo: misma clave, mismo dueno, mismo cliente e importe.
      if (
        prev.creado_por === esperado.creado_por &&
        prev.cliente_id === esperado.cliente_id &&
        Number(prev.total) === Number(esperado.total)
      ) {
        return prev.id;
      }
      throw new ConflictoIdempotencia(
        "Esa operacion ya existe con otros datos. Recarga la ficha del cliente y revisa antes de cargar de nuevo."
      );
    }
  }
  const { data: nueva, error } = await supabase
    .from("ventas")
    .insert({ ...fila, idempotencia_key: idemKey })
    .select("id")
    .single();
  if (error) {
    // Dos submits en paralelo con la misma clave: gana la primera.
    if (idemKey && error.code === "23505") {
      const { data: prev } = await supabase
        .from("ventas")
        .select("id, cliente_id, creado_por, total")
        .eq("idempotencia_key", idemKey)
        .single();
      if (
        prev &&
        prev.creado_por === esperado.creado_por &&
        prev.cliente_id === esperado.cliente_id &&
        Number(prev.total) === Number(esperado.total)
      ) {
        return prev.id;
      }
      if (prev)
        throw new ConflictoIdempotencia(
          "Esa operacion ya existe con otros datos. Recarga la ficha del cliente y revisa antes de cargar de nuevo."
        );
    }
    throw new Error(error.message);
  }
  return nueva.id;
}

export async function crearPagoInicialIdempotente(
  supabase: SupabaseLike,
  fila: Record<string, any>,
  idemKey: string | null,
  ventaId: number
): Promise<void> {
  if (idemKey) {
    const { data: pagoPrev } = await supabase
      .from("pagos")
      .select("id, venta_id, monto")
      .eq("idempotencia_key", idemKey)
      .maybeSingle();
    if (pagoPrev) {
      // El pago de este alta ya se inserto en un intento anterior: no repetir.
      if (pagoPrev.venta_id === ventaId) return;
      throw new ConflictoIdempotencia(
        "Esa operacion ya tiene un pago registrado en otra venta. Recarga la ficha del cliente y revisa antes de cargar de nuevo."
      );
    }
  }
  const { error } = await supabase.from("pagos").insert({
    ...fila,
    venta_id: ventaId,
    idempotencia_key: idemKey,
  });
  if (error) {
    if (idemKey && error.code === "23505") return; // insertado en paralelo
    // La venta ya existe y el form conserva la misma clave: tocar Guardar
    // de nuevo reintenta SOLO el pago, sin duplicar la venta.
    throw new Error(
      `La venta se creo pero el pago inicial fallo: ${error.message}. Toca Guardar venta de nuevo para reintentar solo el pago (no se duplica la venta).`
    );
  }
}
