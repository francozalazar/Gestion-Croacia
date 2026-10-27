import { accesoCompleta, entero, json, rutaValida } from "@/lib/copia-completa/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const NO = { error: "No se pudo completar la copia. Reintentá más tarde." };

// GET ?accion=leer&id=&desde=&largo=   -> tramo de texto de la foto de la base
// GET ?accion=resumen&id=  y  ?accion=objetos&id=&desde=&limite=  -> conteos y lista de archivos de la foto
// GET ?accion=archivo&bucket=&ruta=    -> URL firmada de 5 minutos para bajar un archivo
export async function GET(request: Request) {
  try {
    const db = accesoCompleta(request);
    if (!db) return json({ error: "Acceso no habilitado" }, 401);
    const p = new URL(request.url).searchParams;
    const accion = p.get("accion");
    if (accion === "leer") {
      const id = entero(p.get("id"), 1, 9e15), desde = entero(p.get("desde"), 1, 2147483647), largo = entero(p.get("largo"), 1, 800000);
      if (!id || !desde || !largo) return json({ error: "Consulta inválida" }, 400);
      const { data, error } = await db.rpc("copia_leer", { p_id: id, p_desde: desde, p_largo: largo });
      if (error || typeof data !== "string") throw new Error("lectura");
      // Cantidad de caracteres (puntos de código) del tramo: la PC avanza con este número.
      return new Response(data, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Caracteres": String(Array.from(data).length) } });
    }
    if (accion === "resumen") {
      const id = entero(p.get("id"), 1, 9e15);
      if (!id) return json({ error: "Consulta inválida" }, 400);
      const { data, error } = await db.rpc("copia_resumen", { p_id: id });
      if (error || !data) throw new Error("resumen");
      return json({ version: 1, resumen: data });
    }
    if (accion === "objetos") {
      const id = entero(p.get("id"), 1, 9e15), desde = entero(p.get("desde"), 0, 2147483647), limite = entero(p.get("limite"), 1, 500);
      if (!id || desde === null || !limite) return json({ error: "Consulta inválida" }, 400);
      const { data, error } = await db.rpc("copia_objetos", { p_id: id, p_desde: desde, p_limite: limite });
      if (error || !Array.isArray(data)) throw new Error("objetos");
      return json({ version: 1, objetos: data });
    }
    if (accion === "archivo") {
      const bucket = p.get("bucket") || "", ruta = p.get("ruta") || "";
      if (!rutaValida(bucket, ruta)) return json({ error: "Consulta inválida" }, 400);
      const { data, error } = await db.storage.from(bucket).createSignedUrl(ruta, 300);
      // Solo "no existe" es 404. Cualquier otro error es transitorio o de configuracion: 503 (la PC reintenta).
      if (error) {
        const e = error as { status?: number | string; statusCode?: number | string; message?: string };
        const no = String(e.statusCode ?? e.status ?? "") === "404" || /not.?found/i.test(e.message || "");
        if (no) return json({ error: "Archivo no encontrado" }, 404);
        throw new Error("firma");
      }
      if (!data?.signedUrl) throw new Error("firma");
      return json({ version: 1, url: data.signedUrl });
    }
    return json({ error: "Consulta inválida" }, 400);
  } catch { return json(NO, 503); }
}

// POST ?accion=crear                    -> toma UNA foto consistente de la base en el servidor
// POST ?accion=cerrar&id=&sha256=       -> borra la foto del servidor si el SHA256 de la PC coincide
export async function POST(request: Request) {
  try {
    const db = accesoCompleta(request);
    if (!db) return json({ error: "Acceso no habilitado" }, 401);
    const p = new URL(request.url).searchParams;
    const accion = p.get("accion");
    if (accion === "crear") {
      const { data, error } = await db.rpc("copia_crear");
      const fila = Array.isArray(data) ? data[0] : null;
      if (error || !fila) throw new Error("crear");
      return json({ version: 1, id: fila.r_id, bytes: Number(fila.r_bytes), sha256: fila.r_sha256 });
    }
    if (accion === "cerrar") {
      const id = entero(p.get("id"), 1, 9e15), sha = p.get("sha256") || "";
      if (!id || !/^[a-f0-9]{64}$/.test(sha)) return json({ error: "Consulta inválida" }, 400);
      const { data, error } = await db.rpc("copia_cerrar", { p_id: id, p_sha256: sha });
      if (error) throw new Error("cerrar");
      return json({ version: 1, cerrada: data === true });
    }
    return json({ error: "Consulta inválida" }, 400);
  } catch { return json(NO, 503); }
}
