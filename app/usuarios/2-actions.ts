"use server";

import { randomUUID } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ResultadoAlta = { ok: boolean; mensaje: string };

const ROLES = ["ADMIN", "OFICINA", "COORDINACION", "TECNICO", "FABRICA", "ENCARGADO"];

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
  const rol = String(formData.get("rol") || "").trim().toUpperCase();
  const password = String(formData.get("password") || "");

  if (!nombre || nombre.length > 80 || nombre.includes("@"))
    return { ok: false, mensaje: "Escribí un nombre de hasta 80 caracteres, sin @." };
  if (!ROLES.includes(rol)) return { ok: false, mensaje: "Elegí un rol." };
  if (password.length < 6)
    return { ok: false, mensaje: "La contraseña tiene que tener al menos 6 caracteres." };

  if (rol === "ENCARGADO") {
    const { data: listo, error: errRol } = await supabase.rpc("encargado_version");
    if (errRol || listo !== 1) return { ok: false, mensaje: "El rol Encargado todavía no está habilitado en la base. No se creó nada." };
  }

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

  // El nombre es el acceso visible. No aceptar nombres que el login resolvería
  // a más de una cuenta (también se consideran los apellidos de cuentas previas).
  const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const { data: perfiles, error: errLista } = await admin.from("profiles").select("id, nombre, apellido");
  if (errLista || !perfiles) return { ok: false, mensaje: "No se pudo verificar el nombre. No se creó nada." };
  const repetido = (p: { nombre: string | null; apellido: string | null }) => normalizar(p.nombre || "") === normalizar(nombre) || normalizar(`${p.nombre || ""} ${p.apellido || ""}`) === normalizar(nombre);
  if (perfiles.some(repetido)) return { ok: false, mensaje: "Ya existe ese nombre. Agregá el apellido para distinguirlo." };
  // Identificador técnico no entregable: no se solicita ni se envía correo.
  const email = `usuario-${randomUUID()}@usuarios.croacia.invalid`;

  // 4. Crear el acceso. El trigger de la base crea el perfil con el nombre.
  const { data: creado, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
    app_metadata: rol === "ENCARGADO" ? { rol_inicial: "ENCARGADO" } : {},
  });
  if (error || !creado?.user) {
    const ya = /already|registered|exists/i.test(error?.message || "");
    return {
      ok: false,
      mensaje: ya
        ? "No se pudo crear el acceso. Probá de nuevo."
        : "No se pudo crear el usuario. No se guardó nada.",
    };
  }

  // 5. Rol del perfil. Si falla, se deshace el alta completa para no dejar un usuario con rol equivocado.
  const { data: perfilGuardado, error: errPerfil } = await admin
    .from("profiles")
    .update({ nombre, rol, activo: true })
    .eq("id", creado.user.id)
    .select("id, nombre, rol, activo")
    .single();
  if (errPerfil || !perfilGuardado || perfilGuardado.rol !== rol || perfilGuardado.activo !== true) {
    const { error: errBorrar } = await admin.auth.admin.deleteUser(creado.user.id);
    return {
      ok: false,
      mensaje: errBorrar ? "No se pudo confirmar el rol. Revisá Usuarios antes de reintentar." : "No se pudo guardar el rol. Se deshizo el alta; probá de nuevo.",
    };
  }

  // Releer también después del alta: dos pedidos simultáneos no deben dejar
  // nombres ambiguos. Si hubo carrera, retirar sólo la cuenta recién creada.
  const { data: despues, error: errDespues } = await admin.from("profiles").select("id, nombre, apellido");
  if (errDespues || !despues || despues.some((p) => p.id !== creado.user.id && repetido(p))) {
    const { error: errBorrar } = await admin.auth.admin.deleteUser(creado.user.id);
    return { ok: false, mensaje: errBorrar ? "No se pudo confirmar el alta. Revisá Usuarios antes de reintentar." : "El nombre no pudo confirmarse como único. Usá nombre y apellido y probá de nuevo." };
  }

  return {
    ok: true,
    mensaje: `Usuario creado: ${nombre} (${rol}). Pasale este nombre y la contraseña para que entre.`,
  };
}

export async function cambiarClaveUsuarioAction(
  _prev: ResultadoAlta | null,
  formData: FormData
): Promise<ResultadoAlta> {
  // Solo un administrador logueado puede cambiar contraseñas (se verifica acá, en el servidor).
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
    return { ok: false, mensaje: "Solo un administrador puede cambiar contraseñas." };
  }

  const usuarioId = String(formData.get("usuario_id") || "").trim();
  const password = String(formData.get("password") || "");
  if (!usuarioId) return { ok: false, mensaje: "Falta indicar el usuario." };
  if (password.length < 6)
    return { ok: false, mensaje: "La contraseña tiene que tener al menos 6 caracteres." };
  if (password.length > 72)
    return { ok: false, mensaje: "La contraseña no puede superar los 72 caracteres." };

  // Clave de servidor (nunca va al navegador)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) {
    return {
      ok: false,
      mensaje:
        "Falta configurar la clave de servidor para cambiar contraseñas (SUPABASE_SERVICE_ROLE_KEY en Vercel). No se cambió nada.",
    };
  }
  const admin = createAdminClient(url, clave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Confirmar que el usuario destino existe antes de tocar su acceso.
  const { data: destino, error: errDestino } = await admin
    .from("profiles")
    .select("id, nombre, apellido")
    .eq("id", usuarioId)
    .single();
  if (errDestino || !destino)
    return { ok: false, mensaje: "No se encontró ese usuario. No se cambió nada." };

  const { error } = await admin.auth.admin.updateUserById(usuarioId, { password });
  if (error)
    return { ok: false, mensaje: "No se pudo cambiar la contraseña. Probá de nuevo." };

  const nombre = `${destino.nombre || ""} ${destino.apellido || ""}`.trim() || "el usuario";
  return {
    ok: true,
    mensaje: `Contraseña actualizada para ${nombre}. Pasale la nueva contraseña para que entre.`,
  };
}
