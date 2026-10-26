import { acceso, emitido, fechaDocumento, revision, tecnicoActual, respuesta, TIPOS, type Tipo } from "@/lib/copia-remitos/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const ctx = acceso(request);
    if (!ctx) return respuesta({ error: "Acceso no habilitado" }, 401);
    const url = new URL(request.url);
    const tipo = url.searchParams.get("tipo") as Tipo;
    const after = url.searchParams.get("despues") || "0";
    if (!TIPOS.includes(tipo) || !ctx.tipos.includes(tipo) || !/^\d{1,15}$/.test(after)) return respuesta({ error: "Consulta inválida" }, 400);
    const { data, error } = await ctx.db.from(tipo === "visita" ? "solicitudes" : "solicitudes_fabrica")
      .select("*").gt("id", Number(after)).order("id", { ascending: true }).limit(50);
    if (error || !data) throw new Error("No se pudo leer el listado");
    const documentos = [];
    for (const row of data) {
      if (!emitido(tipo, row, ctx.desde)) continue;
      const tecnico = tipo === "visita" ? await tecnicoActual(ctx.db, row) : "-";
      documentos.push({ id: row.id, tipo, numero: String((tipo === "visita" ? row.numero : row.numero_remito) || row.id),
        cliente: String(row.cliente_nombre || "Sin cliente"), fecha: fechaDocumento(tipo, row), revision: revision(row, tecnico) });
    }
    return respuesta({ version: 1, tipos: ctx.tipos, desde: ctx.desde, documentos,
      siguiente: data.length === 50 ? String(data[data.length - 1].id) : null });
  } catch { return respuesta({ error: "No se pudo consultar la copia. Reintentá más tarde." }, 503); }
}
