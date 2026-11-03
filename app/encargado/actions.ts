"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
export async function operarEncargado(
  accion: string,
  datos: Record<string, unknown>,
) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, mensaje: "Tu sesión venció." };
  const { data: perfil } = await db
    .from("profiles")
    .select("rol,activo")
    .eq("id", user.id)
    .single();
  if (perfil?.rol !== "ENCARGADO" || !perfil.activo)
    return { ok: false, mensaje: "Sin acceso." };
  const { error } = await db.rpc("encargado_operar", {
    p_accion: accion,
    p_datos: datos,
  });
  if (error) return { ok: false, mensaje: error.code === "23505"
    ? "Ese técnico ya tiene un trabajo con esa prioridad para ese día. Elegí otra prioridad."
    : error.message };
  revalidatePath("/encargado");
  return { ok: true, mensaje: "Guardado." };
}

// Trabajos asignados a un técnico un día (para cargar motores usados). Sólo datos operativos.
export async function trabajosTecnicoEncargado(tecnicoId: string, fecha: string) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, trabajos: [] as unknown[] };
  const { data, error } = await db.rpc("encargado_trabajos_tecnico", {
    p_tecnico: tecnicoId,
    p_fecha: fecha,
  });
  if (error) return { ok: false, trabajos: [] as unknown[] };
  return { ok: true, trabajos: (data || []) as unknown[] };
}
