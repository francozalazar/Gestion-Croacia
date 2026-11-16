import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import { montserratRegular, montserratBold, logoRemito } from "./assetsRemito";

export async function generarPDFVisita(solicitud: Record<string, any>, tecnico = "-") {
  const datos = solicitud as Record<string, any>;

  const clienteNombre = datos.cliente_nombre || "-";
  const contacto = datos.contacto || datos.aclaracion_cliente || "-";
  const direccion = datos.direccion || "-";
  const localidad = datos.localidad || "-";
  const tipoSolicitud =
    datos.tipo_visita || datos.tipo_solicitud || datos.tipo || "-";
  const detalleVisita =
    datos.observaciones || datos.detalle_visita || datos.detalle || "-";
  const trabajoRealizado = datos.trabajo_realizado || "-";
  const observacionesTecnico = datos.observaciones_tecnico || "-";
  const aclaracionCliente = datos.aclaracion_cliente || clienteNombre;
  if (datos.tecnico_remito && String(datos.tecnico_remito).trim()) {
    tecnico = String(datos.tecnico_remito).trim();
  }
  const ayudante = datos.ayudante || "-";

  // La fecha del remito es exclusivamente la del cierre del técnico.
  // Nunca se reemplaza por la fecha pactada ni por el día de descarga.
  const cierre = String(datos.fecha_finalizacion || "");
  const fecha = cierre ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(cierre) ? `${cierre}T12:00:00-03:00` : cierre) : null;
  const fechaFinalizacion = fecha && !Number.isNaN(fecha.getTime())
    ? fecha.toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit", month: "2-digit", year: "numeric",
      })
    : "-";

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fuente = await pdf.embedFont(Buffer.from(montserratRegular, "base64"), { subset: true });
  const fuenteNegrita = await pdf.embedFont(Buffer.from(montserratBold, "base64"), { subset: true });
  const logo = await pdf.embedJpg(Buffer.from(logoRemito, "base64"));

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 45;
  const anchoContenido = ancho - margen * 2;
  const negro = rgb(0.05, 0.05, 0.05);

  let pagina = pdf.addPage([ancho, alto]);
  let y = alto - 40;

  function centrado(
    contenido: string,
    yPos: number,
    size: number,
    bold = false
  ) {
    const f = bold ? fuenteNegrita : fuente;
    const w = f.widthOfTextAtSize(contenido, size);
    pagina.drawText(contenido, {
      x: (ancho - w) / 2,
      y: yPos,
      size,
      font: f,
      color: negro,
    });
  }

  function regla(yPos: number, grosor = 1.6) {
    pagina.drawLine({
      start: { x: margen, y: yPos },
      end: { x: ancho - margen, y: yPos },
      thickness: grosor,
      color: negro,
    });
  }

  // Conserva Enter y renglones vacíos; corta también cadenas sin espacios.
  function envolver(contenido: string, maxWidth: number, size = 10.5) {
    const lineas: string[] = [];
    for (const renglon of String(contenido || "-").replace(/\r\n?/g, "\n").split("\n")) {
      let actual = "";
      for (const palabra of renglon.trim().split(/\s+/).filter(Boolean)) {
        let resto = palabra;
        if (actual && fuente.widthOfTextAtSize(`${actual} ${resto}`, size) > maxWidth) {
          lineas.push(actual);
          actual = "";
        }
        while (fuente.widthOfTextAtSize(resto, size) > maxWidth) {
          let n = 1;
          while (n < resto.length && fuente.widthOfTextAtSize(resto.slice(0, n + 1), size) <= maxWidth) n++;
          lineas.push(resto.slice(0, n));
          resto = resto.slice(n);
        }
        actual = actual ? `${actual} ${resto}` : resto;
      }
      lineas.push(actual);
    }
    return lineas;
  }

  function nuevaPagina() {
    pagina = pdf.addPage([ancho, alto]);
    pagina.drawText(`CROACIA SRL | Solicitud de trabajo | N° ${datos.numero || datos.id}`, {
      x: margen, y: alto - 42, size: 10, font: fuenteNegrita, color: negro,
    });
    regla(alto - 53, 1);
    y = alto - 80;
  }

  // =========================
  // ENCABEZADO
  // =========================

  if (logo) {
    const anchoLogo = 250;
    const altoLogo = (logo.height / logo.width) * anchoLogo;
    pagina.drawImage(logo, {
      x: (ancho - anchoLogo) / 2, y: y - altoLogo,
      width: anchoLogo, height: altoLogo,
    });
    y -= altoLogo + 12;
  }

  centrado(
    "Fábrica: Ruta de la Tradición 670, Luis Guillón  4281-3813 / 3966-6430 / 11 5450-2050",
    y,
    7.5
  );
  y -= 11;
  centrado(
    "Suc. Lomas de Zamora: Camino negro, Esq. Colombres  11 5818-4428",
    y,
    7.5
  );
  y -= 11;
  centrado("Suc. La Plata: Av 44 N° 3269  221-363-1000", y, 7.5);
  y -= 20;

  centrado("SOLICITUD DE TRABAJO", y - 16, 21, true);
  y -= 28;
  regla(y, 2.2);
  y -= 24;

  // =========================
  // DATOS
  // =========================

  const numeroRemito = datos.numero || datos.id;

  // Todas las filas comparten los mismos dos ejes y anchos de columna.
  const columnaDerecha = 310;
  const anchoColumna = 240;
  function filaDatos(items: { etiqueta: string; valor: string; x: number; w: number }[]) {
    const celdas = items.map((it) => {
      const prefijo = `${it.etiqueta}: `;
      const offset = fuenteNegrita.widthOfTextAtSize(prefijo, 11);
      return { ...it, prefijo, offset, lineas: envolver(it.valor, Math.max(it.w - offset, 40), 11) };
    });
    const altura = Math.max(...celdas.map((it) => it.lineas.length)) * 14 + 10;
    if (y - altura < 110) nuevaPagina();
    for (const it of celdas) {
      pagina.drawText(it.prefijo, { x: it.x, y, size: 11, font: fuenteNegrita, color: negro });
      it.lineas.forEach((linea, i) => pagina.drawText(linea, {
        x: it.x + it.offset, y: y - i * 14, size: 11, font: fuente, color: negro,
      }));
    }
    y -= altura;
  }
  function fila(etiqueta: string, valor: string, derecha: string, valorDerecha: string) {
    filaDatos([
      { etiqueta, valor, x: margen, w: anchoColumna },
      { etiqueta: derecha, valor: valorDerecha, x: columnaDerecha, w: anchoColumna },
    ]);
  }
  fila("N° remito", String(numeroRemito), "Fecha", fechaFinalizacion);
  fila("Cliente", clienteNombre, "Contacto", contacto);
  fila("Dirección", direccion, "Localidad", String(localidad).toUpperCase());
  fila("Técnico", tecnico, "Ayudante", ayudante);
  filaDatos([{ etiqueta: "Solicitud", valor: tipoSolicitud, x: margen, w: anchoContenido }]);
  y += 4;

  regla(y, 1.4);
  y -= 28;

  // =========================
  // SECCIONES
  // =========================

  function seccion(titulo: string, contenido: string) {
    const lineas = envolver(contenido, anchoContenido);
    if (y < 160) nuevaPagina();
    function encabezado(continuacion = false) {
      pagina.drawText(titulo + (continuacion ? " (continuación)" : ""), {
        x: margen, y, size: 15, font: fuenteNegrita, color: negro,
      });
      y -= 22;
    }
    encabezado();
    for (const linea of lineas) {
      if (y < 100) {
        nuevaPagina();
        encabezado(true);
      }
      pagina.drawText(linea, { x: margen, y, size: 10.5, font: fuente, color: negro });
      y -= 15;
    }
    y -= 4;
    regla(y, 1);
    y -= 30;
  }

  seccion("Detalle de la visita", detalleVisita);
  seccion("Indicaciones del técnico", trabajoRealizado);
  // Aprovecha solo el espacio que sobra: Observaciones queda abajo, separada
  // de Indicaciones, sin mover datos ni empujar una firma que ya cabía.
  const lineasObservaciones = envolver(observacionesTecnico, anchoContenido).length;
  const altoObservaciones = 56 + lineasObservaciones * 15;
  const lineasNombre = envolver(aclaracionCliente, 220, 11).length;
  const reservaFirma = Math.max(80, lineasNombre * 14 + 12) + 125;
  const inicioObservaciones = reservaFirma + altoObservaciones;
  if (y >= inicioObservaciones) y = inicioObservaciones;
  seccion("Observaciones del técnico", observacionesTecnico);

  // =========================
  // FIRMA Y ACLARACIÓN
  // =========================

  const lineasAclaracion = envolver(aclaracionCliente, 220, 11);
  const altoAclaracion = lineasAclaracion.length * 14;
  // Firma y nombre comparten una línea base y nunca pisan el pie.
  const alturaFirma = Math.max(80, altoAclaracion + 12);
  if (y < alturaFirma + 125) nuevaPagina();
  const lineaFirmaY = Math.min(y - alturaFirma - 10, 135);

  if (
    datos.firma_cliente &&
    typeof datos.firma_cliente === "string" &&
    datos.firma_cliente.startsWith("data:image/png;base64,")
  ) {
    try {
      const base64 = datos.firma_cliente.split(",")[1];
      const bytes = Buffer.from(base64, "base64");
      const imagen = await pdf.embedPng(bytes);

      const maxWidth = 150;
      const maxHeight = 80;
      const escala = Math.min(
        maxWidth / imagen.width,
        maxHeight / imagen.height
      );

      pagina.drawImage(imagen, {
        x: margen + (175 - imagen.width * escala) / 2,
        y: lineaFirmaY + 6,
        width: imagen.width * escala,
        height: imagen.height * escala,
      });
    } catch (error) {
      console.error("No se pudo incrustar la firma:", error);
    }
  }

  lineasAclaracion.forEach((linea, i) => {
    const w = fuente.widthOfTextAtSize(linea, 11);
    pagina.drawText(linea, {
      x: (320 + ancho - margen - w) / 2,
      y: lineaFirmaY + 8 + (lineasAclaracion.length - 1 - i) * 14,
      size: 11, font: fuente, color: negro,
    });
  });
  for (const [desde, hasta] of [[margen, 220], [320, ancho - margen]]) {
    pagina.drawLine({ start: { x: desde, y: lineaFirmaY }, end: { x: hasta, y: lineaFirmaY }, thickness: 0.7, color: negro });
  }
  centradoEnZona("Firma", margen, 220, lineaFirmaY - 20);
  centradoEnZona("Aclaración", 320, ancho - margen, lineaFirmaY - 20);

  function centradoEnZona(
    contenido: string,
    xDesde: number,
    xHasta: number,
    yPos: number
  ) {
    const w = fuenteNegrita.widthOfTextAtSize(contenido, 12);
    const centro = (xDesde + xHasta) / 2;
    pagina.drawText(contenido, {
      x: centro - w / 2,
      y: yPos,
      size: 12,
      font: fuenteNegrita,
      color: negro,
    });
  }

  // =========================
  // TEXTO LEGAL
  // =========================

  centrado(
    "La firma de este documento valida la terminación, verificación y aceptación del cliente por medio del firmante.",
    52,
    8
  );
  centrado(
    "El mismo certifica la finalización y conformidad de la realización de la tarea por parte de Croacia S.R.L.",
    40,
    8
  );

  if (pdf.getPageCount() > 1) {
    pdf.getPages().forEach((p, i) => {
      const texto = `Página ${i + 1} de ${pdf.getPageCount()}`;
      p.drawText(texto, { x: ancho - margen - fuente.widthOfTextAtSize(texto, 8), y: 22, size: 8, font: fuente, color: negro });
    });
  }

  const pdfBytes = await pdf.save();

  return { bytes: Buffer.from(pdfBytes), numero: numeroRemito };
        }
