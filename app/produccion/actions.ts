"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { anularVisitas } from "@/lib/anularVisita";

export async function anularProduccionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  if (!id) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol?.toUpperCase() !== "ADMIN") {
    throw new Error("Solo un administrador puede anular trabajos");
  }

  // Primero la visita vinculada (si no está finalizada) y después el pedido.
  // Si algo falla, el pedido sigue visible en Producción y se puede reintentar.
  const errVisita = await anularVisitas(supabase, "solicitud_fabrica_id", id);

  if (errVisita) throw new Error(errVisita.message);

  const { error } = await supabase
    .from("solicitudes_fabrica")
    .update({ estado: "ANULADO" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/produccion");
  revalidatePath("/fabrica");
  revalidatePath("/aprobacion-fabrica");
  revalidatePath("/coordinacion");
  revalidatePath("/trabajos");
}
const estadosProduccionPermitidos = [
  "ENVIADO_A_CORTAR",
  "EN_CORTE",
  "EN_FABRICACION",
  "FALTANTES",
  "LISTO_PARA_COLOCAR",
];

export async function cambiarEstadoProduccionAction(formData: FormData) {
  const id = Number(formData.get("id"));
  const nuevoEstado = String(formData.get("nuevoEstado") || "");
  if (!id || !estadosProduccionPermitidos.includes(nuevoEstado)) return;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("No autorizado");

  const { data: perfil } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol?.toUpperCase() !== "ADMIN") {
    throw new Error("Solo un administrador puede cambiar el estado desde producción");
  }

  if (nuevoEstado === "LISTO_PARA_COLOCAR") {
    // Un solo paso atomico (solicitudes_fabrica y solicitudes juntas), sin stock.
    const { error: errListos } = await supabase.rpc("enviar_a_listos", { p_pedido: id });
    if (errListos) throw new Error(errListos.message);
    revalidatePath("/produccion");
    revalidatePath("/fabrica");
    revalidatePath("/listos-para-colocar");
    return;
  }

  const { error } = await supabase
    .from("solicitudes_fabrica")
    .update({ estado: nuevoEstado })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/produccion");
  revalidatePath("/fabrica");
  revalidatePath("/listos-para-colocar");
}
