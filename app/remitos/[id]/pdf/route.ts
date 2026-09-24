import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const remitoId = Number(id);

  if (!remitoId) {
    return new NextResponse("ID inválido", { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { data: remito, error } = await supabase
    .from("solicitudes_fabrica")
    .select("*")
    .eq("id", remitoId)
    .single();

  if (error || !remito) {
    return new NextResponse("Remito no encontrado", { status: 404 });
  }

  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logo = null;
  try {
    const logoBytes = await fs.readFile(
      path.join(process.cwd(), "public", "logo.png")
    );
    logo = await pdf.embedPng(logoBytes);
  } catch {
    // sin logo, sigue igual
  }

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 45;
  const anchoContenido = ancho - margen * 2;
  const negro = rgb(0.05, 0.05, 0.05);

  let pagina = pdf.addPage([ancho, alto]);
  let y = alto - 40;

  function nuevaPaginaSiHaceFalta(espacio: number) {
    if (y - espacio < 70) {
      pagina = pdf.addPage([ancho, alto]);
      y = alto - 60;
    }
  }

  function centrado(contenido: string, yPos: number, size: number, bold = false) {
    const f = bold ? negrita : fuente;
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

  function campo(etiqueta: string, valor: string, x: number, yPos: number, size = 11) {
    pagina.drawText(`${etiqueta}:`, {
      x,
      y: yPos,
      size,
      font: negrita,
      color: negro,
    });
    const offset = negrita.widthOfTextAtSize(`${etiqueta}: `, size);
    pagina.drawText(String(valor || "-"), {
      x: x + offset,
      y: yPos,
      size,
      font: fuente,
      color: negro,
    });
  }

  function lineasWrap(contenido: string, size: number): string[] {
    const palabras = String(contenido || "").split(/\s+/);
    const lineas: string[] = [];
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? actual + " " + palabra : palabra;
      if (fuente.widthOfTextAtSize(prueba, size) > anchoContenido && actual) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    if (actual) lineas.push(actual);
    return lineas;
  }

  function parrafo(contenido: string, size = 10.5, interlineado = 15) {
    for (const linea of lineasWrap(contenido, size)) {
      nuevaPaginaSiHaceFalta(interlineado + 4);
      pagina.drawText(linea, { x: margen, y, size, font: fuente, color: negro });
      y -= interlineado;
    }
  }

  function seccion(titulo: string, contenido: string) {
    nuevaPaginaSiHaceFalta(70);
    pagina.drawText(titulo, {
      x: margen,
      y,
      size: 15,
      font: negrita,
      color: negro,
    });
    y -= 22;
    parrafo(contenido);
    y -= 4;
    regla(y, 1);
    y -= 30;
  }

  // =========================
  // ENCABEZADO (misma membrete que Solicitud de Trabajo)
  // =========================

  if (logo) {
    const altoLogo = 58;
    const anchoLogo = (logo.width / logo.height) * altoLogo;
    pagina.drawImage(logo, {
      x: (ancho - anchoLogo) / 2,
      y: y - altoLogo,
      width: anchoLogo,
      height: altoLogo,
    });
    y -= altoLogo + 8;
  }

  centrado("CROACIA SRL", y - 16, 20, true);
  y -= 26;
  centrado("FÁBRICA DE CORTINAS METÁLICAS", y - 8, 9, true);
  y -= 22;

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
  centrado("Suc. La Plata: Av 44 N° 3269  11 5659-4671", y, 7.5);
  y -= 30;

  centrado("REMITO", y - 20, 24, true);
  y -= 34;
  regla(y, 2.2);
  y -= 24;

  // =========================
  // DATOS
  // =========================

  const numeroRemito = remito.numero_remito || remito.id;
  const fechaRemito = remito.fecha
    ? new Date(`${remito.fecha}T12:00:00`).toLocaleDateString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "-";

  campo("N° remito", String(numeroRemito), margen, y, 11.5);
  y -= 26;

  campo("Fecha", fechaRemito, margen, y);
  campo("Cliente", remito.cliente_nombre || "-", 175, y);
  if (remito.cliente_telefono) campo("Teléfono", remito.cliente_telefono, 430, y);
  y -= 24;

  campo("Dirección", remito.direccion || "-", margen, y);
  campo("Localidad", String(remito.localidad || "-").toUpperCase(), 350, y);
  y -= 24;

  campo("Estado", String(remito.estado || "-").replaceAll("_", " "), margen, y);
  if (remito.horario_desde && remito.horario_hasta) {
    campo("Horario", `${remito.horario_desde} a ${remito.horario_hasta}`, 195, y);
  }
  if (remito.tipo_visita) campo("Tipo", remito.tipo_visita, 400, y);
  y -= 20;

  regla(y, 1.4);
  y -= 28;

  // =========================
  // DETALLE
  // =========================

  seccion("Detalle del trabajo", remito.observaciones || "Sin detalle cargado.");

  // =========================
  // VALORES
  // =========================

  const plata = (n: any) =>
    n === null || n === undefined || n === ""
      ? "-"
      : "$ " + Number(n).toLocaleString("es-AR", { maximumFractionDigits: 2 });

  if (
    remito.total_pesos ||
    remito.sena_pesos ||
    remito.saldo_restante ||
    remito.medio_pago
  ) {
    nuevaPaginaSiHaceFalta(110);
    pagina.drawText("Valores", {
      x: margen,
      y,
      size: 15,
      font: negrita,
      color: negro,
    });
    y -= 26;
    campo("Total", plata(remito.total_pesos), margen, y);
    y -= 22;
    if (remito.sena_pesos) {
      campo(
        "Seña",
        plata(remito.sena_pesos) +
          (remito.sena_porcentaje ? ` (${remito.sena_porcentaje}%)` : ""),
        margen,
        y
      );
      y -= 22;
    }
    if (remito.saldo_restante !== null && remito.saldo_restante !== undefined) {
      campo("Saldo", plata(remito.saldo_restante), margen, y);
      y -= 22;
    }
    if (remito.medio_pago) {
      campo(
        "Medio de pago",
        remito.medio_pago +
          (remito.aclaracion_pago ? ` — ${remito.aclaracion_pago}` : ""),
        margen,
        y
      );
      y -= 22;
    }
    y -= 8;
    regla(y, 1);
  }

  // =========================
  // PIE
  // =========================

  centrado(
    `Generado el ${new Date().toLocaleDateString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    })} · Croacia S.R.L. · Gestión Cortinas`,
    40,
    8
  );

  const pdfBytes = await pdf.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="remito-${numeroRemito}.pdf"`,
    },
  });
}
