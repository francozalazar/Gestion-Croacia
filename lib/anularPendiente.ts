// Anular un pedido de fábrica que todavía está PENDIENTE_APROBACION.
// Orden: primero se "reclama" el pedido con un update condicional (solo si sigue
// pendiente, así una carrera con "Enviar a cortar" no cancela nada de más) y recién
// después se cancela la visita vinculada. Si la visita falla, se deshace el pedido.
// No borra registros: el pedido queda ANULADO y la visita CANCELADO.
import { anularVisitas } from "./anularVisita";

export type ResultadoAnularPendiente = {
  ok: boolean;
  motivo?: "rol" | "inactivo" | "no_pendiente" | "visita" | "pedido";
  mensaje?: string;
};

export async function anularPedidoPendientePasos(
  supabase: any,
  perfil: { rol?: string | null; activo?: boolean | null } | null,
  pedidoId: number
): Promise<ResultadoAnularPendiente> {
  if (String(perfil?.rol || "").toUpperCase() !== "ADMIN")
    return { ok: false, motivo: "rol", mensaje: "Solo un administrador puede anular pedidos" };
  if (perfil?.activo === false)
    return { ok: false, motivo: "inactivo", mensaje: "Usuario inactivo" };

  const reclamo = await supabase
    .from("solicitudes_fabrica")
    .update({ estado: "ANULADO" })
    .eq("id", pedidoId)
    .eq("estado", "PENDIENTE_APROBACION")
    .select("id");
  if (reclamo.error)
    return { ok: false, motivo: "pedido", mensaje: reclamo.error.message };
  if (!reclamo.data || reclamo.data.length === 0)
    return {
      ok: false,
      motivo: "no_pendiente",
      mensaje: "El pedido ya no está pendiente de aprobación. No se anuló.",
    };

  const errVisita = await anularVisitas(supabase, "solicitud_fabrica_id", pedidoId);
  if (errVisita) {
    await supabase
      .from("solicitudes_fabrica")
      .update({ estado: "PENDIENTE_APROBACION" })
      .eq("id", pedidoId)
      .eq("estado", "ANULADO");
    return { ok: false, motivo: "visita", mensaje: errVisita.message };
  }
  return { ok: true };
}
