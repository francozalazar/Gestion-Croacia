// Corre con: node --experimental-strip-types tests/unirParesTrigger.test.mjs  (Node 22.6+)
import assert from "node:assert";
import { unirParesTrigger } from "../lib/unirParesTrigger.ts";
const ev = (id, t, o = {}) => ({ id, created_at: t, etapa: "Listo para colocar", responsable: "Fabrica", solicitud_fabrica_id: 7, solicitud_id: null, venta_id: null, ...o });
const ids = (l) => unirParesTrigger(l).map((e) => e.id);
// par real: mismo hecho de dos triggers -> 1 renglon
assert.deepEqual(ids([ev(83, "2026-10-23T13:20:00.100Z"), ev(84, "2026-10-23T13:20:00.400Z", { solicitud_id: 51 })]), [84]);
// etapa con detalle entre parentesis en un lado: sigue siendo el mismo hecho y se conserva la etapa mas completa
const r = unirParesTrigger([ev(86, "2026-10-23T13:26:00.1Z", { etapa: "Pendiente de coordinacion" }), ev(87, "2026-10-23T13:26:00.3Z", { solicitud_id: 51, etapa: "Pendiente de coordinacion (instalacion)" })]);
assert.equal(r.length, 1); assert.equal(r[0].etapa, "Pendiente de coordinacion (instalacion)");
// mismo evento repetido de verdad (misma accion horas despues): se conservan ambos
assert.equal(unirParesTrigger([ev(83, "2026-10-23T13:20:00Z"), ev(84, "2026-10-23T13:20:00Z", { solicitud_id: 51 }), ev(95, "2026-10-24T09:00:00Z"), ev(96, "2026-10-24T09:00:00Z", { solicitud_id: 51 })]).length, 2);
// dos solo-fabrica iguales (sin solicitud_id en ninguno): no hay origen dual -> ambos
assert.equal(ids([ev(1, "2026-10-23T13:20:00Z"), ev(2, "2026-10-23T13:20:00Z")]).length, 2);
// dos con solicitud_id iguales: ambos
assert.equal(ids([ev(1, "2026-10-23T13:20:00Z", { solicitud_id: 5 }), ev(2, "2026-10-23T13:20:00Z", { solicitud_id: 5 })]).length, 2);
// otro responsable / otro pedido / otra etapa / otro remito: ambos
for (const o of [{ responsable: "Raquel" }, { solicitud_fabrica_id: 8 }, { etapa: "Aprobado" }]) {
  assert.equal(unirParesTrigger([ev(1, "2026-10-23T13:20:00Z"), ev(2, "2026-10-23T13:20:00Z", { solicitud_id: 5, ...o })]).length, 2);
}
// ids no consecutivos o >2 s: ambos
assert.equal(unirParesTrigger([ev(1, "2026-10-23T13:20:00Z"), ev(10, "2026-10-23T13:20:00Z", { solicitud_id: 5 })]).length, 2);
assert.equal(unirParesTrigger([ev(1, "2026-10-23T13:20:00Z"), ev(2, "2026-10-23T13:20:03Z", { solicitud_id: 5 })]).length, 2);
// ventas y pagos nunca se ocultan
assert.equal(unirParesTrigger([ev(1, "2026-10-23T13:20:00Z", { venta_id: 3 }), ev(2, "2026-10-23T13:20:00Z", { solicitud_id: 5 })]).length, 2);
// no muta la entrada
const ent = [ev(1, "2026-10-23T13:20:00Z"), ev(2, "2026-10-23T13:20:00Z", { solicitud_id: 5 })];
unirParesTrigger(ent); assert.equal(ent.length, 2);
console.log("ok unirParesTrigger");
