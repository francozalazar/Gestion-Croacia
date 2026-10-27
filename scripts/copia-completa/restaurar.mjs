// Restaura una copia completa de Croacia (carpeta copia-AAAAMMDD-HHMMSS) en un Supabase/Postgres VACIO.
// Uso (desde la raiz del repo, Node 20+):
//   node scripts/copia-completa/restaurar.mjs sql <carpeta-copia> <salida.sql>
//   node scripts/copia-completa/restaurar.mjs usuarios <carpeta-copia>        (env SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
//   node scripts/copia-completa/restaurar.mjs archivos <carpeta-copia>        (env SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
// Orden: 1) usuarios 2) ejecutar salida.sql con psql 3) archivos.  Ver RESTAURAR.md.
// Solo lee la copia; nunca borra ni modifica la copia ni la base original.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export function cargar(carpeta) {
  // PowerShell 5.1 puede escribir BOM: se quita antes de parsear.
  const sinBom = (t) => t.replace(/^\uFEFF/, "");
  const crudo = fs.readFileSync(path.join(carpeta, "base-de-datos.json"));
  const man = JSON.parse(sinBom(fs.readFileSync(path.join(carpeta, "manifiesto.json"), "utf8")));
  const sha = crypto.createHash("sha256").update(crudo).digest("hex");
  if (sha !== man.base_de_datos.sha256) throw new Error("base-de-datos.json no coincide con el manifiesto (SHA256). Copia danada.");
  const texto = sinBom(crudo.toString("utf8"));
  // Solo el esquema se usa desde JS. Los DATOS no se reparsean: van a SQL como texto original y los lee jsonb de Postgres
  // (asi bigint/numeric grandes no pierden precision en JavaScript).
  return { base: JSON.parse(texto), man, texto };
}
const q = (s) => `"${String(s).replace(/"/g, '""')}"`;
const lit = (s) => `'${String(s).replace(/'/g, "''")}'`;
function dollar(texto) {
  let tag = "copia"; let i = 0;
  while (texto.includes(`$${tag}$`)) tag = "copia" + ++i;
  return `$${tag}$${texto}$${tag}$`;
}
const ROLES = new Set(["anon", "authenticated", "service_role", "postgres", "supabase_admin", "authenticator", "supabase_auth_admin", "supabase_storage_admin", "PUBLIC"]);
const LETRAS = {
  tabla: { r: "SELECT", a: "INSERT", w: "UPDATE", d: "DELETE", D: "TRUNCATE", x: "REFERENCES", t: "TRIGGER" },
  secuencia: { r: "SELECT", w: "UPDATE", U: "USAGE" },
  funcion: { X: "EXECUTE" },
  columna: { r: "SELECT", a: "INSERT", w: "UPDATE", x: "REFERENCES" },
};
function entradasAcl(acl) {
  const m = acl.replace(/^\{|\}$/g, "").match(/(?:[^,"]|"[^"]*")+/g) || [];
  return m.map((e) => {
    const i = e.indexOf("="), j = e.lastIndexOf("/");
    const quien = e.slice(0, i).replace(/^"|"$/g, "") || "PUBLIC";
    return { quien, privs: e.slice(i + 1, j).replace(/\*/g, ""), dueno: e.slice(j + 1) };
  });
}
// Fiel al original: primero se quita lo que el proyecto nuevo da por defecto (Supabase da EXECUTE/ALL a anon, authenticated, service_role)
// y despues se concede exactamente lo que habia. Si el original tenia un REVOKE, queda revocado.
function permisos(tipo, objeto, acl, cols) {
  if (!acl) return [];
  const out = [`revoke all ${cols ? "(" + cols + ") " : ""}on ${objeto} from public, anon, authenticated, service_role;`];
  for (const e of entradasAcl(acl)) {
    if (e.quien === e.dueno) continue;
    const lista = [...e.privs].map((c) => LETRAS[tipo][c]).filter(Boolean);
    if (!lista.length) continue;
    if (!ROLES.has(e.quien)) { out.push(`-- rol ${e.quien} no soportado en restauracion automatica: ${lista.join(", ")} sobre ${objeto}`); continue; }
    const quien = e.quien === "PUBLIC" ? "public" : q(e.quien);
    out.push(`grant ${lista.join(", ")}${cols ? " (" + cols + ")" : ""} on ${objeto} to ${quien};`);
  }
  return out;
}
export function generarSql({ base, texto }) {
  const e = base.esquema, L = [];
  const nombresTablas = [...new Set(e.columnas.map((c) => c.tabla))];
    const dependeDeTabla = (def) => nombresTablas.some((t) => new RegExp(`returns\\s+(setof\\s+)?(public\\.)?"?${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"?(\\s|$)`, "i").test(def.slice(0, 600)));
  const esCopia = (f) => /^copia_(crear|leer|cerrar|resumen|objetos)$/.test(f.nombre);
  L.push("-- Generado por restaurar.mjs. Ejecutar en un proyecto Supabase NUEVO y VACIO, con rol postgres, en una sola sesion.");
  L.push("-- Orden: 1) restaurar.mjs usuarios  2) este archivo  3) restaurar.mjs archivos.");
  L.push("set check_function_bodies = false;", "begin;");
  L.push(`do $$ begin if exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind in ('r','p','v','m')) then raise exception 'El destino no esta vacio: ya hay tablas o vistas en public. Se cancela sin cambios.'; end if; end $$;`);
  L.push(`create temp table _copia(doc jsonb) on commit drop;`, `insert into _copia values (${dollar(texto)}::jsonb);`);
  for (const x of e.extensiones || []) if (x.nombre !== "plpgsql") L.push(`create extension if not exists ${q(x.nombre)} with schema ${q(x.esquema)};`);
  for (const t of e.tipos || []) {
    if (t.tipo === "e") L.push(`create type public.${q(t.nombre)} as enum (${(t.etiquetas || []).map(lit).join(", ")});`);
    else L.push(`create domain public.${q(t.nombre)} as ${t.base}${t.default ? " default " + t.default : ""}${t.no_nulo ? " not null" : ""}${(t.restricciones || []).map((r) => " " + r).join("")};`);
  }
  for (const sq of (e.secuencias || []).filter((x) => !x.identidad))
    L.push(`create sequence public.${q(sq.nombre)} as ${sq.tipo} increment by ${sq.incremento} minvalue ${sq.minimo} maxvalue ${sq.maximo} start with ${sq.inicio} cache ${sq.cache} ${sq.cicla ? "" : "no "}cycle;`);
  const funcs = e.funciones.filter((f) => !esCopia(f));
  const antes = funcs.filter((f) => !dependeDeTabla(f.definicion)), despues = funcs.filter((f) => dependeDeTabla(f.definicion));
  for (const f of antes) L.push(f.definicion.trim().replace(/;?$/, ";"));
  for (const t of nombresTablas) {
    const cols = e.columnas.filter((c) => c.tabla === t).sort((a, b) => a.orden - b.orden).map((c) => {
      let s = `${q(c.nombre)} ${c.tipo}`;
      if (c.generada === "s") s += ` generated always as (${c.default}) stored`;
      else if (c.identidad === "a") s += " generated always as identity";
      else if (c.identidad === "d") s += " generated by default as identity";
      else if (c.default) s += ` default ${c.default}`;
      if (c.no_nulo && c.identidad === "") s += " not null";
      return s;
    });
    L.push(`create table public.${q(t)} (\n  ${cols.join(",\n  ")}\n);`);
  }
  for (const sq of (e.secuencias || []).filter((x) => !x.identidad && x.propietaria)) {
    const [t, c] = sq.propietaria.split(".");
    L.push(`alter sequence public.${q(sq.nombre)} owned by public.${q(t)}.${q(c)};`);
  }
  for (const f of despues) L.push(f.definicion.trim().replace(/;?$/, ";"));
  for (const k of e.restricciones.filter((k) => ["p", "u"].includes(k.tipo))) L.push(`alter table public.${q(k.tabla)} add constraint ${q(k.nombre)} ${k.definicion};`);
  // Datos con FK/triggers todavia inexistentes. Los usuarios de auth ya existen (paso 1).
  for (const t of nombresTablas) {
    const sobre = e.columnas.some((c) => c.tabla === t && c.identidad === "a") ? " overriding system value" : "";
    const noGen = e.columnas.filter((c) => c.tabla === t && c.generada !== "s").map((c) => q(c.nombre)).join(", ");
    L.push(`insert into public.${q(t)} (${noGen})${sobre} select ${noGen} from jsonb_populate_recordset(null::public.${q(t)}, (select doc->'datos'->${lit(t)} from _copia));`);
  }
  for (const k of e.restricciones.filter((k) => !["p", "u"].includes(k.tipo)).sort((a, b) => (a.tipo === "f") - (b.tipo === "f")))
    L.push(`alter table public.${q(k.tabla)} add constraint ${q(k.nombre)} ${k.definicion};`);
  const enRestriccion = new Set(e.restricciones.map((k) => k.nombre));
  for (const i of e.indices) if (!enRestriccion.has(i.nombre)) L.push(i.definicion + ";");
  for (const sq of e.secuencias || []) if (sq.ultimo_valor !== null && sq.ultimo_valor !== undefined) L.push(`select setval('public.${q(sq.nombre).replace(/'/g, "''")}', ${sq.ultimo_valor}, true);`);
  for (const t of e.triggers) L.push(t.definicion + ";");
  for (const t of e.triggers_auth || []) L.push(t.definicion + ";");
  // Vistas: pueden depender unas de otras; se reintenta en pasadas hasta que todas existan.
  if (e.vistas.length) {
    const defs = e.vistas.map((v) => `create or replace view public.${q(v.nombre)} as ${v.definicion.trim()}`);
    L.push(`do $v$ declare pend text[] := array[${defs.map(lit).join(", ")}]; sig text[]; d text; n int := 0; begin while coalesce(array_length(pend,1),0) > 0 and n <= ${defs.length} loop sig := '{}'; foreach d in array pend loop begin execute d; exception when others then sig := sig || d; end; end loop; pend := sig; n := n + 1; end loop; if coalesce(array_length(pend,1),0) > 0 then raise exception 'No se pudieron crear % vistas', array_length(pend,1); end if; end $v$;`);
  }
  for (const r of e.rls.filter((r) => r.esquema === "public" && r.activo)) L.push(`alter table public.${q(r.tabla)} enable row level security;`);
  for (const r of e.rls.filter((r) => r.esquema === "public" && r.forzado)) L.push(`alter table public.${q(r.tabla)} force row level security;`);
  for (const p of e.policies) {
    const roles = (Array.isArray(p.roles) ? p.roles : String(p.roles).replace(/[{}]/g, "").split(",")).filter(Boolean).join(", ");
    L.push(`create policy ${q(p.policyname)} on ${p.schemaname}.${q(p.tablename)} as ${p.permissive.toLowerCase()} for ${p.cmd.toLowerCase()} to ${roles || "public"}` +
      (p.qual ? ` using (${p.qual})` : "") + (p.with_check ? ` with check (${p.with_check})` : "") + ";");
  }
  for (const g of e.permisos_tablas) L.push(...permisos("tabla", `table public.${q(g.tabla)}`, g.acl));
  for (const g of e.permisos_columnas || []) L.push(...permisos("columna", `table public.${q(g.tabla)}`, g.acl, q(g.columna)));
  for (const sq of e.secuencias || []) L.push(...permisos("secuencia", `sequence public.${q(sq.nombre)}`, sq.acl));
  for (const f of funcs) L.push(...permisos("funcion", `function public.${q(f.nombre)}(${f.argumentos})`, f.acl));
  for (const d of e.privilegios_default || []) L.push(`-- privilegios por defecto del original (informativo): rol ${d.rol} esquema ${d.esquema || "(todos)"} tipo ${d.objeto} acl ${d.acl}`);
  if (base.storage.buckets.length)
    L.push(`insert into storage.buckets select * from jsonb_populate_recordset(null::storage.buckets, (select doc->'storage'->'buckets' from _copia)) on conflict (id) do nothing;`);
  for (const p of e.publicaciones.filter((p) => p.schemaname === "public"))
    L.push(`do $$ begin alter publication ${q(p.pubname)} add table public.${q(p.tablename)}; exception when others then null; end $$;`);
  L.push("commit;");
  return L.join("\n") + "\n";
}
async function cliente() {
  const { createClient } = await import("@supabase/supabase-js");
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno");
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
async function main() {
  const [cmd, carpeta, salida] = process.argv.slice(2);
  if (!cmd || !carpeta) throw new Error("Uso: restaurar.mjs sql|usuarios|archivos <carpeta-copia> [salida.sql]");
  const c = cargar(carpeta);
  if (cmd === "sql") { fs.writeFileSync(salida, generarSql(c)); console.log("Escrito", salida); return; }
  const db = await cliente();
  if (cmd === "usuarios") {
    // Las contrasenas no se respaldan: cada usuario recibe una clave aleatoria y debe usar "olvide mi clave".
    for (const u of c.base.auth_usuarios) {
      const { error } = await db.auth.admin.createUser({ id: u.id, email: u.email, phone: u.telefono || undefined, email_confirm: !!u.email_confirmado,
        password: crypto.randomBytes(24).toString("base64url"), app_metadata: u.app_metadata || {}, user_metadata: u.user_metadata || {} });
      if (error && !/already|exist/i.test(error.message)) throw new Error(`${u.email}: ${error.message}`);
    }
    console.log("Usuarios recreados:", c.base.auth_usuarios.length, "- cada uno debe restablecer su contrasena."); return;
  }
  if (cmd === "archivos") {
    let n = 0;
    for (const a of c.man.archivos) {
      if (!a.archivo) continue;
      const f = path.join(carpeta, "..", ...String(a.archivo).split(/[\\/]/));
      const bytes = fs.readFileSync(f);
      if (crypto.createHash("sha256").update(bytes).digest("hex") !== a.sha256) throw new Error(`SHA256 distinto: ${a.archivo}`);
      const { error } = await db.storage.from(a.bucket).upload(a.ruta, bytes, { upsert: false, contentType: a.tipo || undefined });
      if (error && !/exists|Duplicate/i.test(error.message)) throw new Error(`${a.bucket}/${a.ruta}: ${error.message}`);
      n++;
    }
    console.log("Archivos subidos o ya presentes:", n); return;
  }
  throw new Error("Comando desconocido");
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file://").href) main().catch((e) => { console.error(e.message); process.exit(1); });
