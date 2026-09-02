import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  PDFPage,
} from "pdf-lib";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  const { id } = await params;
  const solicitudId = Number(id);

  if (!solicitudId) {
    return new NextResponse("ID inválido", {
      status: 400,
    });
  }

  const supabase = await createClient();

  // ==========================================
  // USUARIO
  // ==========================================

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new NextResponse("No autorizado", {
      status: 401,
    });
  }

  // ==========================================
  // PERFIL
  // ==========================================

  const { data: profile } = await supabase
    .from("profiles")
    .select("nombre, apellido, rol")
    .eq("id", user.id)
    .single();

  if (
    !profile ||
    !["ADMIN", "OFICINA", "COORDINACION"].includes(
      profile.rol
    )
  ) {
    return new NextResponse("No autorizado", {
      status: 403,
    });
  }

  // ==========================================
  // SOLICITUD
  // ==========================================

  const { data: solicitud, error } = await supabase
    .from("solicitudes")
    .select("*")
    .eq("id", solicitudId)
    .single();

  if (error || !solicitud) {
    return new NextResponse(
      "Trabajo no encontrado",
      {
        status: 404,
      }
    );
  }

  // ==========================================
  // ASIGNACIÓN
  // ==========================================

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
        `${tecnicoData.nombre || ""} ${
          tecnicoData.apellido || ""
        }`.trim() || "-";
    }
  }

  // ==========================================
  // DATOS DE LA SOLICITUD
  // ==========================================

  const datos = solicitud as Record<string, any>;

  const clienteNombre =
    datos.cliente_nombre || "-";

  const clienteTelefono =
    datos.cliente_telefono || "-";

  const direccion =
    datos.direccion || "-";

  const localidad =
    datos.localidad || "-";

  const tipoSolicitud =
    datos.tipo_visita ||
    datos.tipo_solicitud ||
    datos.tipo ||
    "-";

  // Lo que escribió OFICINA
  const detalleVisita =
    datos.observaciones ||
    datos.detalle_visita ||
    datos.detalle ||
    "-";

  // Lo que escribió el TÉCNICO
  const trabajoRealizado =
    datos.trabajo_realizado ||
    "-";

  const observacionesTecnico =
    datos.observaciones_tecnico ||
    "-";

  const aclaracionCliente =
    datos.aclaracion_cliente ||
    "-";

  // ==========================================
  // FECHA DE CARGA
  // ==========================================

  let fechaCarga = "-";

  if (datos.created_at) {
    fechaCarga = new Date(
      datos.created_at
    ).toLocaleString("es-AR", {
      timeZone:
        "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ==========================================
  // FECHA DE VISITA
  // ==========================================

  let fechaVisita = "-";

  if (datos.fecha) {
    fechaVisita = new Date(
      `${datos.fecha}T12:00:00`
    ).toLocaleDateString("es-AR", {
      timeZone:
        "America/Argentina/Buenos_Aires",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  // ==========================================
  // FECHA DE FINALIZACIÓN
  // ==========================================

  let fechaFinalizacion = "-";

  if (datos.fecha_finalizacion) {
    fechaFinalizacion =
      new Date(
        datos.fecha_finalizacion
      ).toLocaleString("es-AR", {
        timeZone:
          "America/Argentina/Buenos_Aires",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }) + " hs";
  }

  // ==========================================
  // CREAR PDF
  // ==========================================

  const pdf = await PDFDocument.create();

  const fuente = await pdf.embedFont(
    StandardFonts.Helvetica
  );

  const fuenteNegrita = await pdf.embedFont(
    StandardFonts.HelveticaBold
  );

  const fuenteItalica = await pdf.embedFont(
    StandardFonts.HelveticaOblique
  );

  // ==========================================
  // LOGO
  // ==========================================

  let logo = null;

  try {
    const logoPath = path.join(
      process.cwd(),
      "public",
      "logo.png"
    );

    const logoBytes =
      await fs.readFile(logoPath);

    logo = await pdf.embedPng(
      logoBytes
    );
  } catch (error) {
    console.error(
      "No se pudo cargar el logo:",
      error
    );
  }

  // ==========================================
  // DIMENSIONES
  // ==========================================

  const ancho = 595.28;
  const alto = 841.89;
  const margen = 40;
  const anchoContenido =
    ancho - margen * 2;

  let pagina!: PDFPage;

  let y = 0;

  function nuevaPagina() {
    pagina = pdf.addPage([
      ancho,
      alto,
    ]);

    y = alto - 35;
  }

  nuevaPagina();

  // ==========================================
  // FUNCIONES
  // ==========================================

  function texto(
    contenido: string,
    x: number,
    yPos: number,
    size = 9,
    bold = false,
    italic = false
  ) {
    pagina.drawText(
      String(contenido || "-"),
      {
        x,
        y: yPos,
        size,
        font: italic
          ? fuenteItalica
          : bold
          ? fuenteNegrita
          : fuente,
        color: rgb(
          0.1,
          0.1,
          0.1
        ),
      }
    );
  }

  function linea(yPos: number) {
    pagina.drawLine({
      start: {
        x: margen,
        y: yPos,
      },
      end: {
        x: ancho - margen,
        y: yPos,
      },
      thickness: 0.8,
      color: rgb(
        0.78,
        0.78,
        0.78
      ),
    });
  }

  function caja(
    x: number,
    yTop: number,
    width: number,
    height: number
  ) {
    pagina.drawRectangle({
      x,
      y: yTop - height,
      width,
      height,
      borderWidth: 0.8,
      borderColor: rgb(
        0.82,
        0.82,
        0.82
      ),
      color: rgb(
        0.98,
        0.98,
        0.98
      ),
    });
  }

  function textoEnvuelto(
    contenido: string,
    x: number,
    yInicial: number,
    maxCaracteres: number,
    size = 8.5,
    espacio = 11
  ) {
    const palabras = String(
      contenido || "-"
    ).split(/\s+/);

    const lineas: string[] = [];

    let actual = "";

    for (const palabra of palabras) {
      const prueba = actual
        ? `${actual} ${palabra}`
        : palabra;

      if (
        prueba.length >
        maxCaracteres
      ) {
        if (actual) {
          lineas.push(actual);
        }

        actual = palabra;
      } else {
        actual = prueba;
      }
    }

    if (actual) {
      lineas.push(actual);
    }

    let posicion = yInicial;

    for (const lineaTexto of lineas) {
      texto(
        lineaTexto,
        x,
        posicion,
        size
      );

      posicion -= espacio;
    }

    return posicion;
  }

  function tituloSeccion(
    titulo: string
  ) {
    texto(
      titulo,
      margen,
      y,
      11,
      true
    );

    y -= 16;
  }

  // ==========================================
  // ENCABEZADO
  // ==========================================

  if (logo) {
    pagina.drawImage(logo, {
      x: margen,
      y: y - 38,
      width: 42,
      height: 42,
    });
  }

  texto(
    "CROACIA S.R.L.",
    margen + 55,
    y - 2,
    18,
    true
  );

  texto(
    "Fábrica de cortinas metálicas",
    margen + 55,
    y - 18,
    8.5
  );

  texto(
    "SOLICITUD DE TRABAJO",
    margen + 55,
    y - 32,
    10.5,
    true
  );

  // ==========================================
  // REMITO
  // ==========================================

  pagina.drawRectangle({
    x: 420,
    y: y - 43,
    width: 135,
    height: 63,
    borderWidth: 1.3,
    borderColor: rgb(
      0.15,
      0.15,
      0.15
    ),
  });

  texto(
    "N° REMITO",
    455,
    y - 1,
    7.5,
    true
  );

  const numeroRemito =
  solicitud.numero ||
  solicitud.id;

  texto(
    String(numeroRemito).padStart(
      5,
      "0"
    ),
    458,
    y - 22,
    17,
    true
  );

  y -= 72;

  linea(y);

  y -= 20;

  // ==========================================
  // DATOS GENERALES
  // ==========================================

  tituloSeccion(
    "DATOS GENERALES"
  );

  const generalesTop = y;

  caja(
    margen,
    generalesTop,
    anchoContenido,
    92
  );

  // Fila 1

  texto(
    "Fecha de carga",
    margen + 12,
    generalesTop - 16,
    7.5,
    true
  );

  texto(
    fechaCarga,
    margen + 12,
    generalesTop - 30,
    8.5
  );

  texto(
    "Fecha de visita",
    210,
    generalesTop - 16,
    7.5,
    true
  );

  texto(
    fechaVisita,
    210,
    generalesTop - 30,
    8.5
  );

 

 

  // Fila 2

  texto(
    "Cliente",
    margen + 12,
    generalesTop - 51,
    7.5,
    true
  );

  texto(
    clienteNombre,
    margen + 12,
    generalesTop - 65,
    8.5
  );

  texto(
    "Teléfono",
    210,
    generalesTop - 51,
    7.5,
    true
  );

  texto(
    clienteTelefono,
    210,
    generalesTop - 65,
    8.5
  );

  texto(
    "Localidad",
    400,
    generalesTop - 51,
    7.5,
    true
  );

  texto(
    localidad,
    400,
    generalesTop - 65,
    8
  );

  // Dirección

  texto(
    "Dirección",
    margen + 12,
    generalesTop - 82,
    7.5,
    true
  );

  texto(
    direccion,
    margen + 60,
    generalesTop - 82,
    8.5
  );

  y =
    generalesTop - 105;

  // ==========================================
  // DATOS DE LA VISITA
  // ==========================================

  tituloSeccion(
    "DATOS DE LA VISITA"
  );

  const visitaTop = y;

  caja(
    margen,
    visitaTop,
    anchoContenido,
    55
  );

  texto(
    "Técnico",
    margen + 12,
    visitaTop - 16,
    7.5,
    true
  );

  texto(
    tecnico,
    margen + 12,
    visitaTop - 30,
    8.5
  );

  texto(
    "Solicitud",
    210,
    visitaTop - 16,
    7.5,
    true
  );

  texto(
    tipoSolicitud,
    210,
    visitaTop - 30,
    8.5
  );

  texto(
    "Finalización",
    390,
    visitaTop - 16,
    7.5,
    true
  );

  texto(
    fechaFinalizacion,
    390,
    visitaTop - 30,
    8
  );

  y =
    visitaTop - 68;

  // ==========================================
  // DETALLE DE LA VISITA
  // ==========================================

  tituloSeccion(
    "DETALLE DE LA VISITA"
  );

  const detalleTop = y;

  caja(
    margen,
    detalleTop,
    anchoContenido,
    65
  );

  textoEnvuelto(
    detalleVisita,
    margen + 12,
    detalleTop - 21,
    95,
    8.5,
    12
  );

  y =
    detalleTop - 80;

  // ==========================================
  // TRABAJO REALIZADO
  // ==========================================

  tituloSeccion(
    "TRABAJO REALIZADO"
  );

  const trabajoTop = y;

  caja(
    margen,
    trabajoTop,
    anchoContenido,
    75
  );

  textoEnvuelto(
    trabajoRealizado,
    margen + 12,
    trabajoTop - 21,
    95,
    8.5,
    12
  );

  y =
    trabajoTop - 90;

  // ==========================================
  // OBSERVACIONES DEL TÉCNICO
  // ==========================================

  tituloSeccion(
    "OBSERVACIONES DEL TÉCNICO"
  );

  const observacionesTop = y;

  caja(
    margen,
    observacionesTop,
    anchoContenido,
    65
  );

  textoEnvuelto(
    observacionesTecnico,
    margen + 12,
    observacionesTop - 21,
    95,
    8.5,
    12
  );

  y =
    observacionesTop - 80;

  // ==========================================
  // CONFORMIDAD DEL CLIENTE
  // ==========================================

  tituloSeccion(
    "CONFORMIDAD DEL CLIENTE"
  );

  texto(
    "Aclaración:",
    margen,
    y,
    8.5,
    true
  );

  texto(
    aclaracionCliente,
    margen + 65,
    y,
    8.5
  );

  y -= 20;

  texto(
    "Firma del cliente",
    margen,
    y,
    8.5,
    true
  );

  y -= 10;

  // ==========================================
  // FIRMA
  // ==========================================

  caja(
    margen,
    y,
    250,
    65
  );

  if (
    datos.firma_cliente &&
    typeof datos.firma_cliente ===
      "string" &&
    datos.firma_cliente.startsWith(
      "data:image/png;base64,"
    )
  ) {
    try {
      const base64 =
        datos.firma_cliente.split(
          ","
        )[1];

      const bytes = Buffer.from(
        base64,
        "base64"
      );

      const imagen =
        await pdf.embedPng(bytes);

      const maxWidth = 220;
      const maxHeight = 52;

      const escala = Math.min(
        maxWidth / imagen.width,
        maxHeight / imagen.height
      );

      pagina.drawImage(
        imagen,
        {
          x: margen + 15,
          y:
            y -
            55 +
            (maxHeight -
              imagen.height *
                escala) /
              2,
          width:
            imagen.width *
            escala,
          height:
            imagen.height *
            escala,
        }
      );
    } catch (error) {
      console.error(
        "Error al cargar firma:",
        error
      );

      texto(
        "Firma registrada",
        margen + 15,
        y - 35,
        8,
        false,
        true
      );
    }
  } else {
    texto(
      datos.firma_cliente ||
        "Firma registrada",
      margen + 15,
      y - 35,
      8,
      false,
      true
    );
  }

  y -= 82;

  // ==========================================
  // TEXTO LEGAL
  // ==========================================

  linea(y);

  y -= 16;

  const textoLegal =
    "La firma de este documento valida la terminación, verificación y aceptación del cliente por medio del firmante. El mismo certifica la finalización y conformidad de la realización de la tarea por parte de Croacia S.R.L.";

  textoEnvuelto(
    textoLegal,
    margen,
    y,
    100,
    7,
    9
  );

  // ==========================================
  // PIE DE PÁGINA
  // ==========================================

  const paginas = pdf.getPages();

  paginas.forEach(
    (paginaActual, indice) => {
      paginaActual.drawLine({
        start: {
          x: margen,
          y: 32,
        },
        end: {
          x: ancho - margen,
          y: 32,
        },
        thickness: 0.7,
        color: rgb(
          0.8,
          0.8,
          0.8
        ),
      });

      paginaActual.drawText(
        "CROACIA S.R.L. - Solicitud de trabajo",
        {
          x: margen,
          y: 19,
          size: 6.5,
          font: fuente,
          color: rgb(
            0.4,
            0.4,
            0.4
          ),
        }
      );

      paginaActual.drawText(
        `Remito Nº ${String(
          numeroRemito
        ).padStart(5, "0")}`,
        {
          x: 245,
          y: 19,
          size: 6.5,
          font: fuente,
          color: rgb(
            0.4,
            0.4,
            0.4
          ),
        }
      );

      paginaActual.drawText(
        `Página ${indice + 1} de ${paginas.length}`,
        {
          x: 465,
          y: 19,
          size: 6.5,
          font: fuente,
          color: rgb(
            0.4,
            0.4,
            0.4
          ),
        }
      );
    }
  );

  // ==========================================
  // GENERAR
  // ==========================================

  const pdfBytes =
    await pdf.save();

  return new NextResponse(
    Buffer.from(pdfBytes),
    {
      status: 200,
      headers: {
        "Content-Type":
          "application/pdf",

        "Content-Disposition":
          `attachment; filename="remito-${String(
            numeroRemito
          ).padStart(5, "0")}.pdf"`,

        "Cache-Control":
          "no-store",
      },
    }
  );
}