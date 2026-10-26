import { acceso, emitido, revision, tecnicoActual, respuesta, TIPOS, type Tipo } from "@/lib/copia-remitos/server";
import { generarPDFVisita } from "@/lib/pdf/visita";
import { generarPDFFabrica } from "@/lib/pdf/fabrica";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: Promise<{ tipo: string; id: string }> }) {
  try {
    const ctx = acceso(request);
    if (!ctx) return respuesta({ error: "Acceso no habilitado" }, 401);
    const { tipo: raw, id } = await params;
    const tipo = raw as Tipo;
    if (!TIPOS.includes(tipo) || !ctx.tipos.includes(tipo) || !/^[1-9]\d{0,14}$/.test(id)) return respuesta({ error: "Consulta inválida" }, 400);
    const { data: row, error } = await ctx.db.from(tipo === "visita" ? "solicitudes" : "solicitudes_fabrica").select("*").eq("id", Number(id)).maybeSingle();
    if (error) throw new Error("Consulta fallida");
    if (!row || !emitido(tipo, row, ctx.desde)) return respuesta({ error: "Documento no disponible" }, 404);
    const tecnico = tipo === "visita" ? await tecnicoActual(ctx.db, row) : "-";
    const rev = revision(row, tecnico);
    const esperado = new URL(request.url).searchParams.get("revision");
    if (esperado !== rev) return respuesta({ error: "Documento actualizado. Volvé a consultar el listado." }, 409);
    const pdf = tipo === "visita" ? await generarPDFVisita(row, tecnico) : await generarPDFFabrica(row);
    return new Response(new Uint8Array(pdf.bytes), { headers: { "Content-Type": "application/pdf", "Cache-Control": "no-store", "X-Remito-Revision": rev } });
  } catch { return respuesta({ error: "No se pudo generar el documento" }, 503); }
}
