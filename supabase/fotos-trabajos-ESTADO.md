# Fotos de trabajos

- 01-preparar.sql: preparación aplicada por el usuario el 23/10/2026 en cortinas-gestion. Crea tabla, bucket privado JPEG 5 MB, policies de lectura/subida por asignación y función atómica finalizar_trabajo_con_foto. Compatible con la interfaz anterior.
- Interfaz publicada: subir una foto antes de finalizar, compresión JPEG, vista previa y errores visibles. Si falla la subida o la función, no se informa finalización. Un reintento reutiliza el archivo y la función acepta repetir la misma operación ya completada.
- La foto se muestra en Precio y Presupuestos mediante URL firmada. Los trabajos anteriores sin foto siguen legibles.
- 02-activar.sql: el usuario lo aplicó el 23/10/2026 después de publicar la interfaz. Trigger exigir_foto_al_finalizar verificado habilitado en solicitudes en producción; definición cotejada con este archivo. No modifica registros históricos ni agrega fotos antiguas.

## Verificación

Build webpack y TypeScript completos. Pruebas PostgreSQL aisladas con roles/policies/triggers de producción: asignación, RPC, requisito de foto, estados, reintentos, lectura autorizada, rechazo anónimo, flujo fábrica y cambios de precio. Históricos sin foto ni fecha pueden pasar de PENDIENTE_PRECIO a PRESUPUESTADO; cambios que no finalizan se conservan.

En producción se subió un JPEG sintético propio de 14.596 bytes por Dashboard Storage, se abrió con URL firmada y su SHA256 coincidió con el original. Acceso público/sin firma rechazado. El objeto se eliminó y la misma URL devuelve Object not found. Sin finalizaciones reales ni cambios de trabajos para probar.

Esto no es una prueba completa de subida/finalización con JWT de técnico: al comprobar la interfaz, el técnico no tenía trabajos pendientes. No se creó un trabajo ficticio para forzar esa prueba.
