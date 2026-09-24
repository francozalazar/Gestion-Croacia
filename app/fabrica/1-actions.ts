"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function actualizarEstadoAction(formData: FormData) {
  const id = formData.get("id");
  const nuevoEstado = formData.get("nuevoEstado") as string;

  if (!id || !nuevoEstado) return;

  const supabase = await createClient();

  // 1. Actualizamos solicitudes_fabrica
  const { error: errFabrica } = await supabase
    .from("solicitudes_fabrica")
    .update({ estado: nuevoEstado })
    .eq("id", id);

  if (errFabrica) {
    console.error("Error al actualizar solicitudes_fabrica:", errFabrica);
    return;
  }

  // 2. Si pasa a LISTO_PARA_COLOCAR, avisamos en la tabla principal solicitudes
  //    (vinculada por solicitud_fabrica_id = id del remito)
  if (nuevoEstado === "LISTO_PARA_COLOCAR") {
    const { error: errPadre } = await supabase
      .from("solicitudes")
      .update({ estado: "LISTO_PARA_COLOCAR" })
      .eq("solicitud_fabrica_id", Number(id));

    if (errPadre) {
      console.error("Error al actualizar tabla solicitudes:", errPadre);
    }
  }

  // Revalidación forzada de rutas y layouts
  revalidatePath("/", "layout");
  revalidatePath("/fabrica");
  revalidatePath("/listos-para-colocar");
}