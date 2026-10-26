import { generarPDFFabrica } from "@/lib/pdf/fabrica";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const remitoId = Number(id);

  if (!remitoId) {
    return new NextResponse("ID inválido", { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { data: remito, error } = await supabase
    .from("solicitudes_fabrica")
    .select("*")
    .eq("id", remitoId)
    .single();

  if (error || !remito) {
    return new NextResponse("Remito no encontrado", { status: 404 });
  }

  if (!String(remito.observaciones || "").trim() && !remito.fecha_finalizado) {
    return new NextResponse(
      "Este pedido todavía no tiene detalle cargado: no hay documento para descargar.",
      { status: 409 }
    );
  }

  const { bytes, numero: numeroRemito } = await generarPDFFabrica(remito);

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pedido-${numeroRemito}.pdf"`,
    },
  });
}
