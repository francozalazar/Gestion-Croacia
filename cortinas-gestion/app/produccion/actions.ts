"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("solicitudes_fabrica")
    .update({ estado: "ANULADO" })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/produccion");
  revalidatePath("/fabrica");
  revalidatePath("/aprobacion-fabrica");
}