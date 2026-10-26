"use server";

import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type ResultadoLogin = { ok: boolean; mensaje: string };

const ERROR_GENERICO = "Usuario o contraseña incorrectos.";

// Minúsculas, sin tildes y sin espacios de más: "  FÁbrica " -> "fabrica"
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Entra con nombre + contraseña (o con email + contraseña, como siempre).
// El email nunca sale del servidor: solo se usa acá para validar la contraseña.
export async function loginAction(
  identificador: string,
  password: string
): Promise<ResultadoLogin> {
  const entrada = String(identificador || "").trim();
  if (!entrada || !password) return { ok: false, mensaje: ERROR_GENERICO };

  let email = entrada.toLowerCase();

  if (!entrada.includes("@")) {
    const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!urlSupabase || !clave) {
      return {
        ok: false,
        mensaje: "Todavía no se puede entrar con el nombre. Por ahora usá tu email.",
      };
    }

    const admin = createAdminClient(urlSupabase, clave, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: perfiles, error } = await admin
      .from("profiles")
      .select("id, nombre, apellido, activo");
    if (error || !perfiles) return { ok: false, mensaje: ERROR_GENERICO };

    const buscado = normalizar(entrada);
    const activos = perfiles.filter((p: any) => p.activo !== false && p.nombre);

    // 1) Coincidencia exacta con el nombre o con "nombre apellido"
    let coincidencias = activos.filter((p: any) => {
      const nombre = normalizar(String(p.nombre));
      const completo = normalizar(`${p.nombre} ${p.apellido || ""}`);
      return nombre === buscado || completo === buscado;
    });
    // 2) Si no hay, con el primer nombre ("Franco" para "Franco Zalazar")
    if (coincidencias.length === 0) {
      coincidencias = activos.filter(
        (p: any) => normalizar(String(p.nombre)).split(" ")[0] === buscado
      );
    }

    if (coincidencias.length > 1) {
      return {
        ok: false,
        mensaje: "Hay más de una persona con ese nombre. Entrá con tu email.",
      };
    }
    if (coincidencias.length === 0) return { ok: false, mensaje: ERROR_GENERICO };

    const { data: datosUsuario } = await admin.auth.admin.getUserById(coincidencias[0].id);
    const emailReal = datosUsuario?.user?.email;
    if (!emailReal) return { ok: false, mensaje: ERROR_GENERICO };
    email = emailReal;
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, mensaje: ERROR_GENERICO };
  return { ok: true, mensaje: "" };
}
