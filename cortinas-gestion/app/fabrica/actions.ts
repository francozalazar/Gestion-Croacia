"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function actualizarEstadoAction(formData: FormData) {
  const id = formData.get("id");
  const nuevoEstado = formData.get("nuevoEstado") as string;

  if (!id || !nuevoEstado) return;

  const supabase = await createClient();

  // 1. Actualizamos solicitudes_fabrica
  const { data: itemFabrica, error: errFabrica } = await supabase
    .from("solicitudes_fabrica")
    .update({ estado: nuevoEstado })
    .eq("id", id)
    .select("numero_remito")
    .single();

  if (errFabrica) {
    console.error("Error al actualizar solicitudes_fabrica:", errFabrica);
    return;
  }

  // 2. Si pasa a LISTO_INSTALACION, actualizamos la tabla principal solicitudes
  if (nuevoEstado === "LISTO_INSTALACION" && itemFabrica?.numero_remito) {
    const { error: errPadre } = await supabase
      .from("solicitudes")
      .update({ estado: "LISTO_INSTALACION" })
      .eq("numero_remito", Number(itemFabrica.numero_remito)); // Convertimos a número por si acaso

    if (errPadre) {
      console.error("Error al actualizar tabla solicitudes:", errPadre);
    }
  }

  // Revalidación forzada de rutas y layouts
  revalidatePath("/", "layout");
  revalidatePath("/fabrica");
  revalidatePath("/listos-para-colocar");
}