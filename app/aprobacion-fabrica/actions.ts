"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { anularPedidoPendientePasos } from "@/lib/anularPendiente";

// Solo ADMIN activo y solo pedidos en PENDIENTE_APROBACION (validado en el servidor).
export async function anularPedidoPendienteAction(id: number) {
  if (!Number.isFinite(id) || id <= 0) return { ok: false, mensaje: "Pedido inválido" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "No autorizado" };

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol,activo")
    .eq("id", user.id)
    .single();

  const r = await anularPedidoPendientePasos(supabase, perfil, id);
  if (r.ok) {
    revalidatePath("/aprobacion-fabrica");
    revalidatePath("/produccion");
    revalidatePath("/fabrica");
    revalidatePath("/coordinacion");
    revalidatePath("/trabajos");
  }
  return { ok: r.ok, mensaje: r.mensaje };
}
