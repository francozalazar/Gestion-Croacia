Pruebas de desarrollo (26/10/2026)

- TypeScript y build Next.js con configuración pública de prueba.
- Parser PowerShell sin errores. Ejecución del motor PowerShell 7 en Linux
  con red y credencial simuladas. No sustituye Windows PowerShell 5.1.
- Dos tipos: primera descarga guarda 2 PDFs.
- Segunda corrida sin cambios: no vuelve a descargarlos.
- Cambio de revisión: conserva anteriores y guarda ambas nuevas versiones.
- Corrupción local: detecta SHA distinto y vuelve a descargar, conservando copia dañada.
- Servicio caído: falla y no actualiza Ultima-copia.txt ni borra PDFs anteriores.
- Disco incorrecto/ausente: se detiene antes de consultar o descargar.
- PDF generado de ambos tipos con datos ficticios: inspección visual completa,
  una página por documento, sin precios ni fotografías.

Pendiente en PC Windows antes de afirmar instalado:
- Doble clic instalador y selector de carpeta.
- DPAPI guarda/recupera credencial para el usuario actual.
- Activación del hash en servidor y descarga real de ambos tipos.
- Segunda descarga sin duplicados y apertura offline.
- No se configuró ninguna tarea automática.
