// Busca un cliente por nombre exacto o lo crea, y registra la dirección.
// Nunca rompe el flujo principal: si algo falla (por ejemplo falta correr
// el SQL nuevo), devuelve lo que haya y sigue como antes.
export async function resolverClienteYDireccion(
  supabase: any,
  {
    nombre,
    direccion,
    localidad,
    userId,
    telefono,
  }: {
    nombre: string;
    direccion: string;
    localidad: string;
    userId: string;
    telefono?: string;
  }
): Promise<{ clienteId: number | null; direccionId: number | null }> {
  const nombreLimpio = nombre.trim();
  const direccionLimpia = direccion.trim();
  const localidadLimpia = localidad.trim() || null;

  let clienteId: number | null = null;

  try {
    const { data: existente } = await supabase
      .from("clientes")
      .select("id")
      .ilike("nombre", nombreLimpio)
      .limit(1)
      .maybeSingle();

    if (existente) {
      clienteId = existente.id;
    } else {
      const { data: creado, error } = await supabase
        .from("clientes")
        .insert({
          nombre: nombreLimpio,
          telefono: telefono?.trim() || null,
          direccion: direccionLimpia,
          localidad: localidadLimpia,
          creado_por: userId,
        })
        .select("id")
        .single();

      if (error || !creado) return { clienteId: null, direccionId: null };
      clienteId = creado.id;
    }
  } catch {
    return { clienteId: null, direccionId: null };
  }

  let direccionId: number | null = null;

  if (clienteId && direccionLimpia) {
    try {
      const { data: dirExistente } = await supabase
        .from("direcciones")
        .select("id")
        .eq("cliente_id", clienteId)
        .ilike("direccion", direccionLimpia)
        .limit(1)
        .maybeSingle();

      if (dirExistente) {
        direccionId = dirExistente.id;
      } else {
        const { data: dirCreada } = await supabase
          .from("direcciones")
          .insert({
            cliente_id: clienteId,
            direccion: direccionLimpia,
            localidad: localidadLimpia,
          })
          .select("id")
          .single();

        direccionId = dirCreada?.id ?? null;
      }
    } catch {
      direccionId = null;
    }
  }

  return { clienteId, direccionId };
}
