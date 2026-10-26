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
    const { data: perfil } = await supabase
      .from("profiles")
      .select("rol,activo")
      .eq("id", user.id)
      .single();
    if (perfil?.rol === "ENCARGADO") {
      const path = request.nextUrl.pathname;
      const permitido =
        path === "/encargado" ||
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
