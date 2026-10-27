# Restaurar una copia completa

Para un proyecto Supabase NUEVO y VACIO (o de pruebas). Nunca contra el proyecto vivo sin revisar antes.

1. Crear los usuarios de Auth con los mismos ids (las contrasenas no se respaldan; reciben clave aleatoria y deben restablecerla):
   `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/copia-completa/restaurar.mjs usuarios <carpeta-copia>`
2. Generar y ejecutar el SQL (tablas, datos, restricciones, indices, funciones, triggers, RLS, policies, permisos, buckets):
   `node scripts/copia-completa/restaurar.mjs sql <carpeta-copia> restaurar.sql` y luego `psql "<cadena-de-conexion>" -f restaurar.sql`
   Verifica antes el SHA256 de base-de-datos.json contra el manifiesto; si no coincide, se detiene.
3. Subir archivos (verifica el SHA256 de cada uno antes de subir):
   `node scripts/copia-completa/restaurar.mjs archivos <carpeta-copia>`
4. Volver a correr supabase/copia-completa-2026-10-26.sql si se quiere seguir copiando desde ese proyecto.

Probado: paso 2 con Postgres embebido (PGlite) sobre datos de prueba (tablas, claves, checks, identidad, enums/domains, secuencias, vistas encadenadas, funciones, triggers, RLS/policies, grants de tabla/columna/funcion), comparando fila por fila.
NO probado contra un Supabase real, ni los pasos 1 y 3. Las contrasenas de Auth no se restauran (clave aleatoria; el restablecimiento por mail no esta verificado). El destino debe estar vacio (el script se detiene si no).
