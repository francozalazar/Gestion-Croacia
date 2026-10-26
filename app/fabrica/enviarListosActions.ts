"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type MotorOpcion = { id: number; nombre: string; cantidad: number };
export type SalidaPrevia = { motor: string; cantidad: number };
export type ContextoListos = {
  ok: boolean;
  mensaje?: string;
  motores: MotorOpcion[];
  salidasPrevias: SalidaPrevia[];
  yaConfirmado: boolean;
};

async function rolActual() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, rol: "" };
  const { data: yo } = await supabase.from("profiles").select("rol").eq("id", user.id).single();
  return { supabase, rol: String(yo?.rol || "").toUpperCase() };
}

export async function cargarContextoListosAction(pedidoId: number): Promise<ContextoListos> {
  const vacio = { motores: [], salidasPrevias: [], yaConfirmado: false };
  const { supabase, rol } = await rolActual();
  if (!["ADMIN", "FABRICA"].includes(rol))
    return { ok: false, mensaje: "No tenés permiso para esto.", ...vacio };

  const [{ data: motores, error: e1 }, { data: movs }, { data: consumo }] = await Promise.all([
    supabase.from("stock_motores").select("id, nombre, cantidad").order("nombre"),
    supabase
      .from("stock_movimientos")
      .select("motor_id, cantidad, tipo")
      .eq("solicitud_fabrica_id", pedidoId)
      .eq("tipo", "SALIDA"),
    supabase
      .from("stock_consumos_pedido")
      .select("solicitud_fabrica_id")
      .eq("solicitud_fabrica_id", pedidoId)
      .maybeSingle(),
  ]);
  if (e1) return { ok: false, mensaje: "No se pudo leer el stock.", ...vacio };

  const lista = (motores || []) as MotorOpcion[];
  const salidasPrevias = (movs || []).map((m) => ({
    motor: lista.find((x) => x.id === m.motor_id)?.nombre || "Motor",
    cantidad: m.cantidad as number,
  }));
  return { ok: true, motores: lista, salidasPrevias, yaConfirmado: !!consumo };
}

export async function enviarAListosAction(
  pedidoId: number,
  items: { motor_id: number; cantidad: number }[]
): Promise<{ ok: boolean; mensaje: string }> {
  const { supabase, rol } = await rolActual();
  if (!["ADMIN", "FABRICA"].includes(rol))
    return { ok: false, mensaje: "No tenés permiso para esto." };
  if (!pedidoId) return { ok: false, mensaje: "Falta el pedido." };
  for (const it of items) {
    if (!it.motor_id || !Number.isInteger(it.cantidad) || it.cantidad <= 0)
      return { ok: false, mensaje: "Cada motor necesita modelo y una cantidad entera mayor a 0." };
  }

  const { data, error } = await supabase.rpc("enviar_a_listos_con_motores", {
    p_pedido: pedidoId,
    p_items: items,
  });
  if (error) {
    return {
      ok: false,
      mensaje: /suficiente stock/i.test(error.message)
        ? "No hay suficiente stock de uno de los motores. No se envió el trabajo ni se descontó nada."
        : "No se pudo enviar el trabajo. No se descontó nada.",
    };
  }

  if (data && (data as { sin_cambios?: boolean }).sin_cambios) {
    revalidatePath("/", "layout");
    return { ok: false, mensaje: "Este trabajo ya se había confirmado y cambió de estado. No se descontó ni se cambió nada." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/fabrica");
  revalidatePath("/produccion");
  revalidatePath("/listos-para-colocar");
  revalidatePath("/stock");
  return { ok: true, mensaje: "Trabajo enviado a Listos para colocar." };
}
