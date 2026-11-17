import { puedeVerFinalizado } from "@/lib/accesoFinalizados";
import { generarPDFVisita } from "@/lib/pdf/visita";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const solicitudId = Number(id);

  if (!solicitudId) {
    return new NextResponse("ID inválido", { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "OFICINA", "COORDINACION"].includes(profile.rol)) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const { data: solicitud, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("id", solicitudId)
    .single();

  if (error || !solicitud) {
    return new NextResponse("Trabajo no encontrado", { status: 404 });
  }

  if (!(await puedeVerFinalizado(supabase, user.id, profile.rol, solicitud))) {
    return new NextResponse("Trabajo no encontrado", { status: 404 });
  }

  if (!solicitud.fecha_finalizacion) {
    return new NextResponse(
      "El comprobante se genera cuando el técnico finaliza el trabajo.",
      { status: 409 }
    );
  }

  const { data: asignacion } = await supabase
    .from("asignaciones")
    .select("usuario_id, tipo")
    .eq("solicitud_id", solicitud.id)
    .maybeSingle();

  let tecnico = "-";

  if (asignacion?.usuario_id) {
    const { data: tecnicoData } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", asignacion.usuario_id)
      .single();

    if (tecnicoData) {
      tecnico =
        `${tecnicoData.nombre || ""} ${tecnicoData.apellido || ""}`.trim() ||
        "-";
    }
  }

  const { bytes, numero: numeroRemito } = await generarPDFVisita(solicitud, tecnico);

    const fechaBase = solicitud.fecha_finalizacion || solicitud.fecha || new Date().toISOString();
    const partesFecha = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(fechaBase)).split("/");
    const segmentos = ["Solicitud de trabajo", String(solicitud.cliente_nombre || "").trim().toUpperCase(), String(solicitud.localidad || "").trim().toUpperCase(), partesFecha.join("_")].filter((s) => s && s !== "-");
    const nombreArchivo = `${segmentos.join(" - ")}.pdf`;

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="remito-${numeroRemito}.pdf"; filename*=UTF-8''${encodeURIComponent(nombreArchivo)}`,
      "Cache-Control": "no-store",
    },
  });
}
