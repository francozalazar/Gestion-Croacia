// Uso: npx tsc lib/anularPendiente.ts lib/anularVisita.ts --outDir /tmp/ap --module nodenext --moduleResolution nodenext --target es2020 --skipLibCheck && PC_DIR=/tmp/ap node tests/anularPendiente.test.mjs
import assert from "node:assert/strict";
const { anularPedidoPendientePasos } = await import(process.env.PC_DIR + "/anularPendiente.js");

function mock(responder) {
  const calls = [];
  const from = (tabla) => {
    const c = { tabla, op: null, datos: null, filtros: [] };
    const chain = {
      select() { return chain; },
      update(d) { c.op = "update"; c.datos = d; return chain; },
      eq(k, v) { c.filtros.push(["eq", k, v]); return chain; },
      neq(k, v) { c.filtros.push(["neq", k, v]); return chain; },
      then(res, rej) { calls.push(c); return Promise.resolve(responder(c, calls) ?? { data: null, error: null }).then(res, rej); },
    };
    return chain;
  };
  return { from, calls };
}
const resumen = (calls) => calls.map((c) => `${c.op}:${c.tabla}:${c.datos?.estado ?? ""}`);
const admin = { rol: "ADMIN", activo: true };

// 1) camino feliz: reclama pedido (condicional) y despues cancela visita
{
  const m = mock((c) => (c.tabla === "solicitudes_fabrica" ? { data: [{ id: 7 }], error: null } : { error: null }));
  const r = await anularPedidoPendientePasos(m, admin, 7);
  assert.equal(r.ok, true);
  assert.deepEqual(resumen(m.calls), ["update:solicitudes_fabrica:ANULADO", "update:solicitudes:CANCELADO"]);
  assert.deepEqual(m.calls[0].filtros, [["eq", "id", 7], ["eq", "estado", "PENDIENTE_APROBACION"]]);
}
// 2) estado avanzado / carrera: el update no afecta filas -> rechaza y NO toca la visita
{
  const m = mock(() => ({ data: [], error: null }));
  const r = await anularPedidoPendientePasos(m, admin, 7);
  assert.equal(r.ok, false); assert.equal(r.motivo, "no_pendiente");
  assert.deepEqual(resumen(m.calls), ["update:solicitudes_fabrica:ANULADO"]);
}
// 3) rol no admin, minusculas admin ok, inactivo, sin perfil: nada se escribe
for (const [p, motivo] of [[{ rol: "OFICINA", activo: true }, "rol"], [{ rol: "ENCARGADO", activo: true }, "rol"], [null, "rol"], [{ rol: "ADMIN", activo: false }, "inactivo"]]) {
  const m = mock(() => ({ data: [{ id: 7 }], error: null }));
  const r = await anularPedidoPendientePasos(m, p, 7);
  assert.equal(r.ok, false); assert.equal(r.motivo, motivo); assert.equal(m.calls.length, 0);
}
{
  const m = mock((c) => (c.tabla === "solicitudes_fabrica" ? { data: [{ id: 7 }], error: null } : { error: null }));
  assert.equal((await anularPedidoPendientePasos(m, { rol: "admin", activo: true }, 7)).ok, true);
}
// 4) falla la visita: se deshace el pedido (vuelve a PENDIENTE_APROBACION, condicional a ANULADO)
{
  const m = mock((c) => c.tabla === "solicitudes" ? { error: { message: "falla" } } : { data: [{ id: 7 }], error: null });
  const r = await anularPedidoPendientePasos(m, admin, 7);
  assert.equal(r.ok, false); assert.equal(r.motivo, "visita");
  assert.deepEqual(resumen(m.calls), ["update:solicitudes_fabrica:ANULADO", "update:solicitudes:CANCELADO", "update:solicitudes_fabrica:PENDIENTE_APROBACION"]);
  assert.deepEqual(m.calls[2].filtros, [["eq", "id", 7], ["eq", "estado", "ANULADO"]]);
}
// 5) error al reclamar el pedido: no toca visita
{
  const m = mock(() => ({ data: null, error: { message: "rls" } }));
  const r = await anularPedidoPendientePasos(m, admin, 7);
  assert.equal(r.ok, false); assert.equal(r.motivo, "pedido"); assert.equal(m.calls.length, 1);
}
console.log("anularPendiente: OK");
