// Corre con: for tz in UTC America/Argentina/Buenos_Aires Asia/Tokyo; do TZ=$tz node --experimental-strip-types tests/fechasFicha.test.mjs; done
// (Node 22.6+). No forma parte del build de Next/tsc (.mjs fuera de include).
import assert from "node:assert";
import { fechaLinda, fechaHoraLinda } from "../lib/fechasFicha.ts";
assert.equal(fechaLinda("2026-10-21"), "21/10/2026");
assert.equal(fechaHoraLinda("2026-10-21"), "21/10/2026");
assert.equal(fechaLinda("2026-10-26T02:30:00Z"), "25/10/2026");
assert.equal(fechaHoraLinda("2026-10-26T16:00:00Z"), "26/10/2026 13:00");
assert.equal(fechaLinda("basura"), null);
assert.equal(fechaLinda(null), null);
assert.ok(new Date("2026-10-26T15:59:59Z").getTime() < new Date("2026-10-26T16:00:00Z").getTime());
console.log("ok TZ=" + process.env.TZ);
