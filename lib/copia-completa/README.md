# Copia completa privada

Apagada salvo que exista COPIA_COMPLETA_TOKEN_SHA256 (hash SHA256 de la clave que genera la PC; no es la clave) en el servidor.
Credencial propia, distinta de COPIA_REMITOS_TOKEN_SHA256. Solo Production en Vercel; no Preview/Development.

Requiere correr una vez supabase/copia-completa-2026-10-26.sql (funciones solo para service_role).

## Que hace
- `POST accion=crear`: el servidor arma UNA foto JSON de toda la base en una sola sentencia SQL (una sola foto de la base:
  tablas, relaciones, esquema, lista de archivos y usuarios coinciden entre si). La guarda 2 dias como maximo en copia_privada.
- `GET accion=leer|resumen|objetos`: la PC baja la foto por tramos y su lista de archivos.
- `GET accion=archivo`: URL firmada de 5 minutos para bajar un archivo de Storage (fotos-trabajos, facturas, cualquier bucket).
- `POST accion=cerrar`: borra la foto del servidor solo si el SHA256 calculado en la PC coincide.

## Que incluye
Todas las tablas de `public` (excepto push_*), esquema (columnas, restricciones, indices, RLS, policies, funciones, triggers,
vistas, permisos, publicaciones, extensiones), buckets y lista de objetos, usuarios de Auth sin contrasena, y cada archivo con SHA256.

## Estados de una corrida
- `completa`: unica que cuenta como copia diaria. Todo archivo coincide con la foto (MD5 del servidor, o, si el etag no es MD5, dos descargas identicas por SHA256; el manifiesto marca `verificacion`).
- `incompleta` (carpeta `-INCOMPLETA`, salida 2): algun archivo cambio, falto o no coincide. No cuenta, no habilita Automatico, se reintenta con espera creciente (30 min, 1 h, 2 h ... hasta 24 h; `Estado-copia.json`). No se borra ninguna copia del usuario.
- En el servidor hay UNA sola foto a la vez (copia_crear borra las anteriores). Antes de copiar se exige espacio libre >= 1 GB y 3 veces la ultima base.
- Archivos: almacen comun `archivos/` verificado; si un archivo cambia se guarda `.v-<sha8>` al lado, nunca se pisa una version. Copias ya hechas no se reescriben.

## Limites reales y cosas SIN probar
- Restauracion probada SOLO con Postgres embebido (PGlite) sobre datos de prueba: tablas, claves, checks, identidad, enums/domains, secuencias, extensiones, funciones, vistas encadenadas, triggers (incluido uno en auth), RLS/policies, grants de tabla/columna/funcion con revokes. NO probada en un Supabase real, ni la subida de archivos ni la creacion de usuarios Auth.
- Auth: las contrasenas NO se respaldan; los usuarios se recrean con clave aleatoria. El restablecimiento por mail (SMTP) no esta verificado. No se promete autenticacion restaurada.
- Particiones y tipos compuestos no soportados: la copia falla avisando. Limite 45 tablas, documento maximo 200 MB, statement_timeout 120 s: no verificados con volumen real.
- Privilegios por defecto (default privileges) se exportan como comentario; el restore no los aplica. Las definiciones de funciones se revisan por posibles secretos (solo nombres, ver `revision_definiciones`); alertas se avisan en el manifiesto y en Ultima-copia-completa.txt.
- Consistencia: los datos son una sola foto SQL; Storage se baja despues (no atomico). Si cambia, la corrida queda incompleta.
- Windows PowerShell 5.1, DPAPI y Programador de tareas NO probados: pruebas con PowerShell 7 en Linux contra una ruta real servida localmente y un PostgREST/Storage simulado.
- No incluye push_*, secretos de entorno, configuracion de Auth ni logs. Datos sin cifrar en disco. Una sola PC/disco es un unico punto de falla.

## Esquema real inventariado (26/10/2026, solo lectura, sin datos ni definiciones)
PostgreSQL 17.6, plan Free. 21 tablas en public (3 push_* excluidas), todas simples (bigint, numeric, text, date, time, timestamptz, uuid, boolean, integer); sin enums/domains/compuestos/vistas/materializadas/particiones/herencia/reglas/agregados/operadores/esquemas propios/columnas con permisos propios. 15 secuencias (identity siempre/por defecto y numero_remito_seq compartida por solicitudes.numero y solicitudes_fabrica.numero_remito). 23 funciones (1 usa Vault y pg_net hacia gestion-croacia.vercel.app; ninguna con secreto embebido segun el escaneo), 78 policies (6 en storage), triggers propios mas on_auth_user_created en auth.users, 1 job de pg_cron, extensiones pg_cron/pg_net/supabase_vault/pgcrypto/uuid-ossp (ya presentes en un proyecto Supabase nuevo), 2 buckets privados, 12 objetos (1,4 MB, todos con etag MD5), 9 usuarios Auth, base total 14 MB. Si el esquema cambia a algo no soportado, copia_crear falla avisando (no hace una copia que parezca completa).
No se respalda: secreto del Vault (croacia_push_dispatch), job de cron, ni event triggers de Supabase; hay que recrearlos a mano por los canales seguros.
