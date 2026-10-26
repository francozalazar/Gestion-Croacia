# Copia exclusiva de remitos

Apagada salvo que existan todas estas variables privadas del servidor:

- COPIA_REMITOS_TOKEN_SHA256: SHA256 hexadecimal minúscula de la clave aleatoria
  generada en la PC Windows. No es la clave y no sirve como bearer.
- COPIA_REMITOS_TIPOS: visita,fabrica (o uno de los dos).
- COPIA_REMITOS_DESDE: YYYY-MM-DD. Para la prueba histórica: 0001-01-01.

Usa la clave Supabase de servidor ya existente, nunca enviada al programa.
La API sólo exporta metadatos mínimos y PDFs, tiene sólo métodos GET y no
expone consultas arbitrarias. Ningún usuario nuevo ni modificación de SQL/RLS.
Los endpoints anteriores conservan su sesión y permisos.

El instalador genera 256 bits aleatorios, protege la clave con DPAPI del usuario
actual, y muestra únicamente el hash. Configurar ese hash habilita esa PC. Para
revocar quitar COPIA_REMITOS_TOKEN_SHA256 y publicar de nuevo. El despliegue
anterior no debe quedar públicamente accesible con la clave vigente: proteger
los despliegues preview y no habilitar estas variables para Preview/Development.

Se lista por ID, con 50 filas por página. Cada ejecución recorre de nuevo todo
el listado para detectar ediciones de registros antiguos. SHA256 de datos fuente
+ técnico + versión de formato detecta cambios; la revisión se verifica de nuevo
antes de renderizar cada PDF para evitar asociar la descarga a otra revisión.
La fecha de generación impresa no determina la revisión. Cambiar pdf-v1 si cambia
el formato. No se borran documentos locales ausentes en la lista posterior.

Esto no es una copia de la base ni de fotos ni un archivo inmutable para fines
legales. Puede faltar cualquier dato borrado antes de descargar. El token otorga
lectura de los dos tipos y sólo de los documentos emitidos dentro del período.
