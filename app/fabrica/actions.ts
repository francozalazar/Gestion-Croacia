"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function actualizarEstadoAction(formData: FormData) {
  const id = formData.get("id");
  const nuevoEstado = formData.get("nuevoEstado") as string;

  if (!id || !nuevoEstado) return;

  const supabase = await createClient();

  // Terminado: un solo paso atomico en la base (actualiza solicitudes_fabrica y solicitudes juntas,
  // solo ADMIN/FABRICA, solo desde produccion). Sin stock: los motores los carga Admin.
  if (nuevoEstado === "LISTO_PARA_COLOCAR") {
    const { error } = await supabase.rpc("enviar_a_listos", { p_pedido: Number(id) });
    if (error) {
      console.error("Error al enviar a Listos para colocar:", error);
      return;
    }
    revalidatePath("/", "layout");
    revalidatePath("/fabrica");
    revalidatePath("/listos-para-colocar");
    return;
  }

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
