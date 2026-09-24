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
  const negro = rgb(0.1, 0.1, 0.1);
  const gris = rgb(0.45, 0.45, 0.45);

  let pagina = pdf.addPage([ancho, alto]);
  let y = alto - 50;

  function nuevaPaginaSiHaceFalta(espacio: number) {
    if (y - espacio < 60) {
      pagina = pdf.addPage([ancho, alto]);
      y = alto - 60;
    }
  }

  function texto(
    contenido: string,
    x: number,
    yPos: number,
    size: number,
    bold = false,
    color = negro
  ) {
    pagina.drawText(contenido, {
      x,
      y: yPos,
      size,
      font: bold ? negrita : fuente,
      color,
    });
  }

  function lineaWrap(contenido: string, size: number, bold = false): string[] {
    const f = bold ? negrita : fuente;
    const palabras = contenido.split(/\s+/);
    const lineas: string[] = [];
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? actual + " " + palabra : palabra;
      if (f.widthOfTextAtSize(prueba, size) > anchoContenido) {
        if (actual) lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    if (actual) lineas.push(actual);
    return lineas;
  }

  function parrafo(contenido: string, size = 10, bold = false, gap = 6) {
    for (const linea of lineaWrap(contenido, size, bold)) {
      nuevaPaginaSiHaceFalta(size + 4);
      texto(linea, margen, y, size, bold);
      y -= size + 4;
    }
    y -= gap;
  }

  function campo(etiqueta: string, valor: string) {
    nuevaPaginaSiHaceFalta(14);
    texto(etiqueta, margen, y, 9, true, gris);
    parrafo(valor, 10, false, 8);
  }

  // Encabezado
  if (logo) {
    const escala = 55 / logo.height;
    pagina.drawImage(logo, {
      x: margen,
      y: y - 55,
      width: logo.width * escala,
      height: 55,
    });
  }

  const titulo = `REMITO Nº ${remito.numero_remito || remito.id}`;
  const wTitulo = negrita.widthOfTextAtSize(titulo, 18);
  texto(titulo, ancho - margen - wTitulo, y - 20, 18, true);

  const fechaRemito = remito.fecha
    ? new Date(`${remito.fecha}T12:00:00`).toLocaleDateString("es-AR")
    : "-";
  const wFecha = fuente.widthOfTextAtSize(`Fecha: ${fechaRemito}`, 10);
  texto(`Fecha: ${fechaRemito}`, ancho - margen - wFecha, y - 40, 10, false, gris);

  y -= 80;

  pagina.drawLine({
    start: { x: margen, y },
    end: { x: ancho - margen, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  y -= 25;

  // Cliente
  texto("CLIENTE", margen, y, 9, true, gris);
  y -= 16;
  parrafo(remito.cliente_nombre || "-", 13, true, 2);
  campo(
    "DIRECCIÓN",
    [remito.direccion, remito.localidad].filter(Boolean).join(" - ") || "-"
  );
  if (remito.cliente_telefono) campo("TELÉFONO", remito.cliente_telefono);

  campo("ESTADO", (remito.estado || "-").replaceAll("_", " "));
  if (remito.horario_desde && remito.horario_hasta) {
    campo("HORARIO", `${remito.horario_desde} a ${remito.horario_hasta}`);
  }
  if (remito.tipo_visita) campo("TIPO", remito.tipo_visita);

  // Detalle
  y -= 5;
  nuevaPaginaSiHaceFalta(30);
  texto("DETALLE DEL TRABAJO", margen, y, 9, true, gris);
  y -= 16;
  parrafo(remito.observaciones || "Sin detalle cargado.", 10, false, 10);

  // Montos
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
    nuevaPaginaSiHaceFalta(90);
    y -= 5;
    pagina.drawLine({
      start: { x: margen, y },
      end: { x: ancho - margen, y },
      thickness: 1,
      color: rgb(0.85, 0.85, 0.85),
    });
    y -= 20;
    texto("VALORES", margen, y, 9, true, gris);
    y -= 16;
    campo("TOTAL", plata(remito.total_pesos));
    if (remito.sena_pesos) {
      campo(
        "SEÑA",
        plata(remito.sena_pesos) +
          (remito.sena_porcentaje ? ` (${remito.sena_porcentaje}%)` : "")
      );
    }
    if (remito.saldo_restante) campo("SALDO", plata(remito.saldo_restante));
    if (remito.medio_pago) {
      campo(
        "MEDIO DE PAGO",
        remito.medio_pago +
          (remito.aclaracion_pago ? ` — ${remito.aclaracion_pago}` : "")
      );
    }
  }

  // Pie
  pagina.drawText(
    `Generado el ${new Date().toLocaleDateString("es-AR")} · Gestión Cortinas`,
    { x: margen, y: 30, size: 8, font: fuente, color: gris }
  );

  const pdfBytes = await pdf.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="remito-${remito.numero_remito || remito.id}.pdf"`,
    },
  });
}
