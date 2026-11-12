import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },

        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: perfil, error: errPerfil } = await supabase
      .from("profiles")
      .select("rol,activo")
      .eq("id", user.id)
      .single();
    // Usuario dado de baja: se le cierra la sesión en el servidor y no se le responde nada más.
    // 42501: la base rechaza a los usuarios dados de baja (también al leer su propio perfil).
    if ((perfil && perfil.activo === false) || errPerfil?.code === "42501") {
      await supabase.auth.signOut();
      const bloqueo = request.nextUrl.pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Sin acceso" }, { status: 403 })
        : NextResponse.redirect(new URL("/", request.url));
      response.cookies.getAll().forEach((c) => bloqueo.cookies.set(c));
      return bloqueo;
    }
    if (perfil?.rol === "ENCARGADO") {
      const path = request.nextUrl.pathname;
      const permitido =
        path === "/encargado" ||
        path === "/api/push/suscripcion" ||
        path === "/push-sw.js" ||
        path === "/manifest.webmanifest" ||
        path.startsWith("/encargado/") ||
        path.startsWith("/_next/");
      if (!perfil.activo || !permitido) {
        if (path.startsWith("/api/"))
          return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
        const destino = request.nextUrl.clone();
        destino.pathname = perfil.activo ? "/encargado" : "/";
        destino.search = "";
        if (!perfil.activo && path === "/") return response;
        return NextResponse.redirect(destino);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
