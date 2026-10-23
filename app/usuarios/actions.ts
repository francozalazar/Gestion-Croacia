"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ResultadoAlta = { ok: boolean; mensaje: string };

const ROLES = ["ADMIN", "OFICINA", "COORDINACION", "TECNICO", "FABRICA"];

export async function crearUsuarioAction(
  _prev: ResultadoAlta | null,
  formData: FormData
): Promise<ResultadoAlta> {
  // 1. Solo un administrador logueado puede crear usuarios (se verifica acá, en el servidor).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, mensaje: "Tu sesión venció. Entrá de nuevo." };

  const { data: yo } = await supabase
    .from("profiles")
    .select("rol")
    .eq("id", user.id)
    .single();
  if (!yo || String(yo.rol).toUpperCase() !== "ADMIN") {
    return { ok: false, mensaje: "Solo un administrador puede crear usuarios." };
  }

  // 2. Datos del formulario
  const nombre = String(formData.get("nombre") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const rol = String(formData.get("rol") || "").trim().toUpperCase();
  const password = String(formData.get("password") || "");

  if (!nombre) return { ok: false, mensaje: "Falta el nombre." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false, mensaje: "El email no es válido." };
  if (!ROLES.includes(rol)) return { ok: false, mensaje: "Elegí un rol." };
  if (password.length < 6)
    return { ok: false, mensaje: "La contraseña tiene que tener al menos 6 caracteres." };

  // 3. Clave de servidor (nunca va al navegador)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    return {
      ok: false,
      mensaje:
        "Falta configurar la clave de servidor para crear usuarios (SUPABASE_SERVICE_ROLE_KEY en Vercel). Todavía no se creó nada.",
    };
  }
  const admin = createAdminClient(url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4. Crear el acceso. El trigger de la base crea el perfil con el nombre.
  const { data: creado, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });
  if (error || !creado?.user) {
    const ya = /already|registered|exists/i.test(error?.message || "");
    return {
      ok: false,
      mensaje: ya
        ? "Ya existe un usuario con ese email."
        : "No se pudo crear el usuario. No se guardó nada.",
    };
  }

  // 5. Rol del perfil. Si falla, se deshace el alta completa para no dejar un usuario con rol equivocado.
  const { error: errPerfil } = await admin
    .from("profiles")
    .update({ nombre, rol, activo: true })
    .eq("id", creado.user.id);
  if (errPerfil) {
    await admin.auth.admin.deleteUser(creado.user.id);
    return {
      ok: false,
      mensaje: "No se pudo guardar el rol. Se deshizo el alta; probá de nuevo.",
    };
  }

  return {
    ok: true,
    mensaje: `Usuario creado: ${nombre} (${rol}). Pasale el email y la contraseña para que entre.`,
  };
}
