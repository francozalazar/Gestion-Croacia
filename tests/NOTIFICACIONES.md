# Verificación de avisos del circuito

Sin conexión a producción ni envío a dispositivos: todas las bases y las entregas de estas pruebas son aisladas.

Requiere Node 22, TypeScript y @electric-sql/pglite en el entorno de pruebas.

```
node tests/notificacionesCircuito.cjs
node tests/notificacionesPipeline.cjs
node tests/notificacionesDispatcher.cjs
node tests/notificacionesGuardadoFinal.cjs
node tests/notificacionesListos.cjs
node tests/notificacionesSW.cjs
node tests/notificacionesToast.cjs
node --experimental-strip-types tests/avisoPush.test.mjs
node --experimental-strip-types tests/avisosVendedor.test.mjs
```

- Pipeline: SQL real genera cola y el dispatcher real produce los cuatro mensajes iniciales; envío web-push simulado.
- Listos: cinco estados de producción, autor Oficina activo, transición, no-op, rollback y rerun sin avisos retroactivos; quinto mensaje generado por dispatcher real.
- Dispatcher: destinatario, estado actual, técnico/fecha, reintento por dispositivo, 410 y errores de lectura.
- Guardado final: la reasignación no encola hasta el UPDATE final del trabajo. Incluye cambio de técnico en la misma fecha y compensación tras fallo.
- SW: rutas de apertura permitidas, receptor técnico conservado y tags estables.
- Inicio: refresco parcial sin cartel; evento final coincidente con cartel; evento repetido u obsoleto sin cartel.

Aplicación de SQL, en orden:
1. notificaciones-circuito-2026-10-30.sql
2. notificaciones-guardar-final-2026-10-30.sql (compatible con instalación original)
3. notificaciones-listos-2026-10-30.sql, sólo después de publicar el servidor que reconoce fabrica_lista.

El proveedor push puede aceptar el aviso y fallar luego el guardado de su entrega. Ese caso puede reenviar el mismo evento. Su tag estable reduce duplicados visibles, pero no se promete entrega exactamente una vez. Los eventos vencen al cabo de una hora o seis intentos. El rol sin dispositivos suscritos no recibe push. Las pruebas aisladas no prueban recepción física en cada dispositivo.
