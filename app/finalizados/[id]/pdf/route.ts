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
  const solicitudId = Number(id);

  if (!solicitudId) {
    return new NextResponse("ID inválido", { status: 400 });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "OFICINA", "COORDINACION"].includes(profile.rol)) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const { data: solicitud, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("id", solicitudId)
    .single();

  if (error || !solicitud) {
    return new NextResponse("Trabajo no encontrado", { status: 404 });
  }

  const { data: asignacion } = await supabase
    .from("asignaciones")
    .select("usuario_id, tipo")
    .eq("solicitud_id", solicitud.id)
    .maybeSingle();

  let tecnico = "-";

  if (asignacion?.usuario_id) {
    const { data: tecnicoData } = await supabase
      .from("profiles")
      .select("nombre, apellido")
      .eq("id", asignacion.usuario_id)
      .single();

    if (tecnicoData) {
      tecnico =
        `${tecnicoData.nombre || ""} ${tecnicoData.apellido || ""}`.trim() ||
        "-";
    }
  }

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
  const ayudante = datos.ayudante || "-";

  let fechaVisita = "-";
  if (datos.fecha) {
    fechaVisita = new Date(`${datos.fecha}T12:00:00`).toLocaleDateString(
      "es-AR",
      {
        timeZone: "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }
    );
  }

  const pdf = await PDFDocument.create();
  const fuente = await pdf.embedFont(StandardFonts.Helvetica);
  const fuenteNegrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  let logo = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoBytes = await fs.readFile(logoPath);
    logo = await pdf.embedPng(logoBytes);
  } catch (err) {
    console.error("Logo no encontrado:", err);
  }

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 45;
  const anchoContenido = ancho - margen * 2;
  const negro = rgb(0.05, 0.05, 0.05);

  const pagina = pdf.addPage([ancho, alto]);
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

  function campo(
    etiqueta: string,
    valor: string,
    x: number,
    yPos: number,
    size = 11
  ) {
    pagina.drawText(`${etiqueta}:`, {
      x,
      y: yPos,
      size,
      font: fuenteNegrita,
      color: negro,
    });
    const offset = fuenteNegrita.widthOfTextAtSize(`${etiqueta}: `, size);
    pagina.drawText(String(valor || "-"), {
      x: x + offset,
      y: yPos,
      size,
      font: fuente,
      color: negro,
    });
  }

  function envuelto(
    contenido: string,
    x: number,
    yInicial: number,
    maxWidth: number,
    size = 10.5,
    interlineado = 15
  ) {
    const palabras = String(contenido || "-").split(/\s+/);
    const lineas: string[] = [];
    let actual = "";

    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      if (
        fuente.widthOfTextAtSize(prueba, size) > maxWidth &&
        actual
      ) {
        lineas.push(actual);
        actual = palabra;
      } else {
        actual = prueba;
      }
    }
    if (actual) lineas.push(actual);

    let posicion = yInicial;
    for (const lineaTexto of lineas) {
      pagina.drawText(lineaTexto, {
        x,
        y: posicion,
        size,
        font: fuente,
        color: negro,
      });
      posicion -= interlineado;
    }
    return posicion;
  }

  // =========================
  // ENCABEZADO
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

  centrado("SOLICITUD DE TRABAJO", y - 20, 24, true);
  y -= 34;
  regla(y, 2.2);
  y -= 24;

  // =========================
  // DATOS
  // =========================

  const numeroRemito = datos.numero || datos.id;

  campo("N° remito", String(numeroRemito), margen, y, 11.5);
  y -= 26;

  campo("Fecha", fechaVisita, margen, y);
  campo("Cliente", clienteNombre, 175, y);
  campo("Contacto", contacto, 430, y);
  y -= 24;

  campo("Dirección", direccion, margen, y);
  campo("Localidad", String(localidad).toUpperCase(), 350, y);
  y -= 24;

  campo("Técnico", tecnico, margen, y);
  campo("Ayudante", ayudante, 195, y);
  campo("Solicitud", tipoSolicitud, 360, y);
  y -= 20;

  regla(y, 1.4);
  y -= 28;

  // =========================
  // SECCIONES
  // =========================

  function seccion(titulo: string, contenido: string) {
    pagina.drawText(titulo, {
      x: margen,
      y,
      size: 15,
      font: fuenteNegrita,
      color: negro,
    });
    y -= 22;
    y = envuelto(contenido, margen, y, anchoContenido, 10.5, 15);
    y -= 4;
    regla(y, 1);
    y -= 30;
  }

  seccion("Detalle de la visita", detalleVisita);
  seccion("Indicaciones del técnico", trabajoRealizado);
  y -= 30;
  seccion("Observaciones del técnico", observacionesTecnico);

  // =========================
  // FIRMA Y ACLARACIÓN
  // =========================

  const zonaFirmaY = Math.min(y - 30, 190);

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
        x: margen + 30,
        y: zonaFirmaY - 55,
        width: imagen.width * escala,
        height: imagen.height * escala,
      });
    } catch (error) {
      console.error("No se pudo incrustar la firma:", error);
    }
  }

  // Aclaración (nombre del firmante), a la derecha
  const anchoAclaracion = fuente.widthOfTextAtSize(aclaracionCliente, 11);
  pagina.drawText(aclaracionCliente, {
    x: Math.min(430 - anchoAclaracion / 2, ancho - margen - anchoAclaracion),
    y: zonaFirmaY - 5,
    size: 11,
    font: fuente,
    color: negro,
  });

  centradoEnZona("Firma", margen, 220, zonaFirmaY - 60);
  centradoEnZona("Aclaración", 320, ancho - margen, zonaFirmaY - 60);

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

  const pdfBytes = await pdf.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="remito-${String(
        numeroRemito
      ).padStart(5, "0")}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
