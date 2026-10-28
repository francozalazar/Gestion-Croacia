// Prueba determinista de los pasos con rollback usando un cliente Supabase simulado.
// Uso: npx tsc lib/pasosCircuito.ts lib/anularVisita.ts --outDir /tmp/pc --module nodenext --moduleResolution nodenext --target es2020 --skipLibCheck && node tests/pasosCircuito.test.mjs
import assert from "node:assert/strict";
const { enviarACoordinacionPasos, asignarPasos, quitarOAnularPasos } = await import(process.env.PC_DIR + "/pasosCircuito.js");

// Cliente simulado: registra cada llamada y responde segun una funcion.
function mock(responder) {
  const calls = [];
  const from = (tabla) => {
    const c = { tabla, op: null, datos: null, filtros: [], select: false, single: false };
    const chain = {
      select(x) { if (!c.op) c.op = "select"; else c.select = x; return chain; },
      update(d) { c.op = "update"; c.datos = d; return chain; },
      insert(d) { c.op = "insert"; c.datos = d; return chain; },
      upsert(d, o) { c.op = "upsert"; c.datos = d; return chain; },
      delete() { c.op = "delete"; return chain; },
      eq(k, v) { c.filtros.push(["eq", k, v]); return chain; },
      neq(k, v) { c.filtros.push(["neq", k, v]); return chain; },
      maybeSingle() { c.single = true; return chain; },
      then(res, rej) { calls.push(c); return Promise.resolve(responder(c, calls) ?? { data: null, error: null }).then(res, rej); },
    };
    return chain;
  };
  return { from, calls };
}
const resumen = (calls) => calls.map((c) => `${c.op}:${c.tabla}`);
const ERR = { message: "falla simulada" };
const datos = { estado: "ASIGNADO", fecha: "2026-11-02" };

// 1) Enviar a coordinacion: orden visita -> pedido; falla de visita no toca el pedido
let m = mock(() => ({ error: null }));
let r = await enviarACoordinacionPasos(m, 7, { estado: "PENDIENTE_COORDINACION" });
assert.equal(r.ok, true); assert.deepEqual(resumen(m.calls), ["update:solicitudes", "update:solicitudes_fabrica"]);
m = mock((c) => (c.tabla === "solicitudes" ? { error: ERR } : { error: null }));
r = await enviarACoordinacionPasos(m, 7, {});
assert.equal(r.ok, false); assert.equal(r.etapa, "visita"); assert.deepEqual(resumen(m.calls), ["update:solicitudes"]);
m = mock((c) => (c.tabla === "solicitudes_fabrica" ? { error: ERR } : { error: null }));
r = await enviarACoordinacionPasos(m, 7, {});
assert.equal(r.ok, false); assert.equal(r.etapa, "pedido");

// 2) Asignar (fabrica, sin asignacion previa): falla el pedido -> se borra la asignacion nueva
const base = { id: 9, esFabrica: true, tecnicoId: "T1", fecha: "2026-11-02", prioridad: 2, datosActualizacion: datos };
m = mock((c) => {
  if (c.op === "select") return { data: null, error: null };
  if (c.op === "delete") return { data: [{ id: 1 }], error: null };
  if (c.tabla === "solicitudes_fabrica" && c.op === "update") return { error: ERR };
  return { error: null };
});
r = await asignarPasos(m, base);
assert.equal(r.ok, false); assert.equal(r.etapa, "pedido"); assert.equal(r.deshecho, true);
assert.deepEqual(resumen(m.calls), ["select:asignaciones", "insert:asignaciones", "update:solicitudes", "update:solicitudes_fabrica", "delete:asignaciones"]);
// reintento con exito
m = mock((c) => (c.op === "select" ? { data: null, error: null } : { error: null }));
r = await asignarPasos(m, base); assert.equal(r.ok, true);

// 3) Asignar con asignacion previa: falla la visita -> se restaura la previa, sin tocar el pedido
const previa = { id: 5, usuario_id: "T0", fecha: "2026-10-30", tipo: "TECNICO", prioridad: 1, solicitud_fabrica_id: 9, solicitud_id: null };
m = mock((c) => {
  if (c.op === "select") return { data: previa, error: null };
  if (c.tabla === "solicitudes" && c.op === "update") return { error: ERR };
  return { error: null };
});
r = await asignarPasos(m, base);
assert.equal(r.ok, false); assert.equal(r.etapa, "visita"); assert.equal(r.deshecho, true);
const restaura = m.calls.at(-1);
assert.equal(restaura.op, "update"); assert.equal(restaura.tabla, "asignaciones");
assert.equal(restaura.datos.usuario_id, "T0"); assert.equal("id" in restaura.datos, false);
assert.ok(!resumen(m.calls).includes("update:solicitudes_fabrica"));

// 4) Asignar: falla al guardar la asignacion (prioridad repetida) -> no se toca nada mas
m = mock((c) => (c.op === "select" ? { data: null, error: null } : { error: { message: "dup", code: "23505" } }));
r = await asignarPasos(m, base);
assert.equal(r.ok, false); assert.equal(r.etapa, "asignacion"); assert.equal(r.error.code, "23505");
assert.deepEqual(resumen(m.calls), ["select:asignaciones", "insert:asignaciones"]);

// 5) Asignar: si ademas falla el deshacer, deshecho = false (la UI avisa que reintente)
m = mock((c) => {
  if (c.op === "select") return { data: null, error: null };
  if (c.op === "delete") return { data: null, error: ERR };
  if (c.op === "update") return { error: ERR };
  return { error: null };
});
r = await asignarPasos(m, base); assert.equal(r.ok, false); assert.equal(r.deshecho, false);

// 6) Quitar asignacion: sin permisos (0 filas) no cambia estados
const fila = { id: 3, solicitud_fabrica_id: 9, solicitud_id: null, usuario_id: "T1", fecha: "2026-11-02", tipo: "TECNICO", prioridad: 2 };
const q = { id: 9, esFabrica: true, tecnicoId: "T1", fecha: "2026-11-02", accion: "QUITAR" };
m = mock((c) => (c.op === "delete" ? { data: [], error: null } : { error: null }));
r = await quitarOAnularPasos(m, q); assert.equal(r.ok, false); assert.equal(r.sinPermiso, true); assert.deepEqual(resumen(m.calls), ["delete:asignaciones"]);
// falla el estado del pedido -> se reinserta la asignacion
m = mock((c) => {
  if (c.op === "delete") return { data: [fila], error: null };
  if (c.tabla === "solicitudes_fabrica" && c.op === "update") return { error: ERR };
  return { error: null };
});
r = await quitarOAnularPasos(m, q);
assert.equal(r.ok, false); assert.equal(r.etapa, "pedido"); assert.equal(r.deshecho, true);
const ins = m.calls.at(-1); assert.equal(ins.op, "insert"); assert.equal(ins.datos[0].usuario_id, "T1"); assert.equal("id" in ins.datos[0], false);
// exito
m = mock((c) => (c.op === "delete" ? { data: [fila], error: null } : { error: null }));
r = await quitarOAnularPasos(m, q);
assert.equal(r.ok, true); assert.deepEqual(resumen(m.calls), ["delete:asignaciones", "update:solicitudes", "update:solicitudes_fabrica"]);
assert.equal(m.calls[1].datos.estado, "PENDIENTE_COORDINACION");

// 7) Anular: la visita queda CANCELADO (el check de la base no admite ANULADO) y el pedido ANULADO
m = mock((c) => (c.op === "delete" ? { data: [fila], error: null } : { error: null }));
r = await quitarOAnularPasos(m, { ...q, accion: "ANULAR" });
assert.equal(r.ok, true);
assert.equal(m.calls[1].tabla, "solicitudes"); assert.equal(m.calls[1].datos.estado, "CANCELADO");
assert.ok(m.calls[1].filtros.some(([o, k, v]) => o === "neq" && k === "estado" && v === "FINALIZADO"));
assert.equal(m.calls[2].tabla, "solicitudes_fabrica"); assert.equal(m.calls[2].datos.estado, "ANULADO");
// anular: falla la visita -> el pedido no se anula y la asignacion vuelve
m = mock((c) => {
  if (c.op === "delete") return { data: [fila], error: null };
  if (c.tabla === "solicitudes" && c.op === "update") return { error: ERR };
  return { error: null };
});
r = await quitarOAnularPasos(m, { ...q, accion: "ANULAR" });
assert.equal(r.ok, false); assert.equal(r.etapa, "visita"); assert.equal(r.deshecho, true);
assert.ok(!resumen(m.calls).includes("update:solicitudes_fabrica")); assert.equal(m.calls.at(-1).op, "insert");
// visita comun (no fabrica): solo la visita, CANCELADO
m = mock((c) => (c.op === "delete" ? { data: [{ ...fila, solicitud_id: 4, solicitud_fabrica_id: null }], error: null } : { error: null }));
r = await quitarOAnularPasos(m, { id: 4, esFabrica: false, tecnicoId: "T1", fecha: "2026-11-02", accion: "ANULAR" });
assert.equal(r.ok, true); assert.deepEqual(resumen(m.calls), ["delete:asignaciones", "update:solicitudes"]);
assert.equal(m.calls[1].datos.estado, "CANCELADO");

console.log("OK: pasosCircuito, todas las comprobaciones pasaron");
