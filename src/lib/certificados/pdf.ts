import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

/**
 * Certificado UVA — diseño real enviado por el cliente en Canva
 * (https://www.canva.com/design/DAHUiNVjhZE, página 4 del handoff:
 * "Certificado Diploma de Reconocimiento Profesional Orgánico Verde").
 *
 * El fondo decorativo (ondas verdes), el logo "UVA", los rótulos fijos
 * ("CERTIFICADO DE PARTICIPACIÓN", "otorgado a", "por participar y aprobar
 * el curso de"), las firmas y sus cargos ("CEO") se exportan tal cual desde
 * Canva como una sola imagen de fondo a página completa — son 100%
 * estáticos en el diseño aprobado, así que se reproducen pixel a pixel sin
 * reinterpretarlos a mano (ver `assets/fondo-certificado.png`, exportado a
 * 3369×2382 — 3x — desde esa misma página). Solo los campos que varían por
 * certificado (nombre del estudiante, curso, fecha, duración, código de
 * verificación, URL y QR) se borran de su posición original y se dibujan
 * encima como texto vectorial, en las coordenadas y tipografías exactas
 * medidas sobre el diseño original (JSON de Canva + muestreo de píxeles
 * sobre la exportación en alta resolución, para las cajas de texto en
 * fuentes cursivas cuya métrica visual no coincide con la del archivo).
 *
 * Conversión de unidades: el lienzo de Canva mide 1123×794 en sus unidades
 * de diseño (px a 96dpi ≈ A4 horizontal). SCALE = 0.75 las lleva a puntos
 * PDF (72dpi) sin distorsión, y PAGE_W/PAGE_H quedan a milímetros de A4.
 *
 * Fuentes:
 *   - Great Vibes (nombre, curso y firmas si se llegan a redibujar) y
 *     Belleza (fecha) — Google Fonts, licencia OFL, igual que las que ya
 *     usaba este archivo.
 *   - Garet (título y bloque de verificación) — no está en Google Fonts;
 *     se descargó de 1001fonts bajo su licencia "Free For Commercial Use"
 *     (FFC), que permite explícitamente incrustarla en un PDF generado por
 *     una aplicación (no así redistribuir el .ttf suelto — ver
 *     `fonts/Garet-EULA.pdf`).
 */

const FONTS_DIR = path.join(process.cwd(), "src/lib/certificados/fonts");
const ASSETS_DIR = path.join(process.cwd(), "src/lib/certificados/assets");

/** Unidades de diseño Canva (px @96dpi, lienzo 1123×794) -> puntos PDF (72dpi). */
const SCALE = 0.75;
const PAGE_W = 1123 * SCALE;
const PAGE_H = 794 * SCALE;

const NEGRO = rgb(0, 0, 0);
const VERDE_OSCURO = rgb(0x24 / 255, 0x34 / 255, 0x1c / 255); // #24341C (texto del pie y de la fecha)
const ROSA_PASTILLA = rgb(253 / 255, 125 / 255, 185 / 255); // #FD7DB9 (muestreado de la píldora de fecha)
const FONDO = rgb(0xfa / 255, 0xfd / 255, 0xf8 / 255); // #FAFDF8 (fondo del certificado)

function u(unidadesDisenio: number) {
  return unidadesDisenio * SCALE;
}

function centrarX(texto: string, font: PDFFont, size: number, centroXPt: number) {
  return centroXPt - font.widthOfTextAtSize(texto, size) / 2;
}

/** `y` (desde abajo, como pide pdf-lib) para que el CENTRO vertical del texto caiga en `centroYDisenio` (medido desde arriba, en unidades Canva). */
function baselineParaCentroVertical(centroYDisenio: number, font: PDFFont, size: number) {
  const centroYPt = PAGE_H - u(centroYDisenio);
  const ascent = font.heightAtSize(size, { descender: false });
  const descent = font.heightAtSize(size) - ascent;
  return centroYPt - (ascent - descent) / 2;
}

function borrar(pagina: PDFPage, x0Disenio: number, x1Disenio: number, y0Disenio: number, y1Disenio: number, color: ReturnType<typeof rgb> = FONDO) {
  pagina.drawRectangle({
    x: u(x0Disenio),
    y: PAGE_H - u(y1Disenio),
    width: u(x1Disenio - x0Disenio),
    height: u(y1Disenio - y0Disenio),
    color,
  });
}

/** Píldora tipo cápsula (rectángulo + dos semicírculos), centrada en (centroXPt, centroYPt). */
function dibujarPastilla(pagina: PDFPage, centroXPt: number, centroYPt: number, anchoPt: number, altoPt: number, color: ReturnType<typeof rgb>) {
  const r = altoPt / 2;
  const anchoRecto = Math.max(0, anchoPt - altoPt);
  pagina.drawRectangle({ x: centroXPt - anchoRecto / 2, y: centroYPt - r, width: anchoRecto, height: altoPt, color });
  pagina.drawEllipse({ x: centroXPt - anchoRecto / 2, y: centroYPt, xScale: r, yScale: r, color });
  pagina.drawEllipse({ x: centroXPt + anchoRecto / 2, y: centroYPt, xScale: r, yScale: r, color });
}

export async function construirCertificadoPdf({
  nombreEstudiante,
  cursoTitulo,
  fechaEmision,
  duracionTexto,
  codigoVerificacion,
  urlVerificacion,
  urlVerificacionQr,
}: {
  nombreEstudiante: string;
  cursoTitulo: string;
  fechaEmision: Date;
  /** Texto ya formado, p.ej. "14 horas de teoría y práctica", o null si no hay duración registrada. */
  duracionTexto: string | null;
  codigoVerificacion: string;
  /** Texto a imprimir (sin protocolo, como en el diseño: "uva.co/verificar/..."). */
  urlVerificacion: string;
  /** URL completa (con https://) que codifica el QR — tiene que ser la que de verdad resuelve al escanearla. */
  urlVerificacionQr: string;
}): Promise<Uint8Array> {
  const [fondoBytes, greatVibesBytes, bellezaBytes, garetBytes] = await Promise.all([
    readFile(path.join(ASSETS_DIR, "fondo-certificado.png")),
    readFile(path.join(FONTS_DIR, "GreatVibes-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "Belleza-Regular.ttf")),
    readFile(path.join(FONTS_DIR, "Garet-Book.ttf")),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  // calt/liga deshabilitados: pdf-lib no aplica shaping OpenType completo
  // (sin GPOS de contexto), y con esas features activas fontkit sustituye
  // algunos glifos de Great Vibes por variantes de ancho erróneo — se ve
  // como un hueco a mitad de palabra (p.ej. "Interiores" -> "Interior es").
  const sinLigaduras = { features: { calt: false, liga: false } };
  const greatVibes = await pdfDoc.embedFont(greatVibesBytes, sinLigaduras);
  const belleza = await pdfDoc.embedFont(bellezaBytes, sinLigaduras);
  const garet = await pdfDoc.embedFont(garetBytes, sinLigaduras);
  const fondoImagen = await pdfDoc.embedPng(fondoBytes);

  const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const cx = PAGE_W / 2;

  pagina.drawImage(fondoImagen, { x: 0, y: 0, width: PAGE_W, height: PAGE_H });

  // --- Nombre del estudiante (reemplaza "[Nombre Estudiante]") ----------
  // Caja original (Canva): top=333.65 left=209.16 width=704.20 height=79.67.
  // Centro visual real medido sobre la exportación en alta resolución
  // (fuente cursiva: la caja del JSON no coincide con la tinta visible).
  borrar(pagina, 175, 950, 310, 415);
  {
    const tamanoBase = u(66.6667);
    const anchoMaximo = PAGE_W - u(120);
    const anchoBase = greatVibes.widthOfTextAtSize(nombreEstudiante, tamanoBase);
    const tamano = anchoBase > anchoMaximo ? tamanoBase * (anchoMaximo / anchoBase) : tamanoBase;
    pagina.drawText(nombreEstudiante, {
      x: centrarX(nombreEstudiante, greatVibes, tamano, cx),
      y: baselineParaCentroVertical(365.8, greatVibes, tamano),
      size: tamano,
      font: greatVibes,
      color: NEGRO,
    });
  }

  // --- Título del curso (reemplaza "[Nombre Curso]") ---------------------
  // Caja original: top=441.09 left=373.37 width=375.77 height=48. La línea
  // divisoria bajo el bloque de nombre está en y=483.09 — no se puede tocar.
  borrar(pagina, 150, 975, 434, 481.5);
  {
    const tamanoBase = u(40);
    const anchoMaximo = PAGE_W - u(160);
    const anchoBase = greatVibes.widthOfTextAtSize(cursoTitulo, tamanoBase);
    const tamano = anchoBase > anchoMaximo ? tamanoBase * (anchoMaximo / anchoBase) : tamanoBase;
    pagina.drawText(cursoTitulo, {
      x: centrarX(cursoTitulo, greatVibes, tamano, cx),
      y: baselineParaCentroVertical(460.5, greatVibes, tamano),
      size: tamano,
      font: greatVibes,
      color: NEGRO,
    });
  }

  // --- Píldora de fecha (reemplaza "xx de xx de xxxx") -------------------
  // Píldora original medida sobre la imagen: alto 33.5u, ancho 157u,
  // centro en (561.5, 533.25). Se reconstruye del mismo alto/color pero con
  // ancho dinámico (el padding se deriva del propio diseño para que quede
  // proporcionado sin importar cuántos caracteres tenga la fecha real).
  borrar(pagina, 450, 675, 505, 562);
  {
    const fechaTexto = fechaEmision.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Bogota",
    });
    const tamano = u(17.3336);
    const altoPastilla = u(33.5);
    const centroYPt = PAGE_H - u(533.25);

    const textoPlaceholderOriginal = "xx de xx de xxxx";
    const anchoPlaceholderOriginal = belleza.widthOfTextAtSize(textoPlaceholderOriginal, tamano);
    const paddingHorizontal = Math.max(0, u(157) - anchoPlaceholderOriginal);

    const anchoTexto = belleza.widthOfTextAtSize(fechaTexto, tamano);
    const anchoPastilla = Math.max(altoPastilla, anchoTexto + paddingHorizontal);

    dibujarPastilla(pagina, cx, centroYPt, anchoPastilla, altoPastilla, ROSA_PASTILLA);
    pagina.drawText(fechaTexto, {
      x: centrarX(fechaTexto, belleza, tamano, cx),
      y: baselineParaCentroVertical(533.25, belleza, tamano),
      size: tamano,
      font: belleza,
      color: VERDE_OSCURO,
    });
  }

  // --- Bloque de verificación (pie) --------------------------------------
  // Caja original: top=683.78 left=354.87 width=412.78 height=50.35,
  // fontSize=7.7857, lineHeight=1.4 -> 4 líneas espaciadas cada u(10.9).
  borrar(pagina, 330, 795, 678, 742);
  {
    const tamano = u(7.785714);
    const alturaLinea = 7.785714 * 1.4;
    const topCaja = 683.78;

    const fechaTexto = fechaEmision.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "America/Bogota",
    });

    const lineas = [
      "Certificación de aprobación online:",
      duracionTexto ? `Aprobado el ${fechaTexto} con ${duracionTexto}` : `Aprobado el ${fechaTexto}`,
      urlVerificacion,
      `Código: ${codigoVerificacion}`,
    ];

    lineas.forEach((linea, i) => {
      const centroYDisenio = topCaja + alturaLinea * (i + 0.5);
      pagina.drawText(linea, {
        x: centrarX(linea, garet, tamano, cx),
        y: baselineParaCentroVertical(centroYDisenio, garet, tamano),
        size: tamano,
        font: garet,
        color: NEGRO,
      });
    });
  }

  // --- QR de verificación --------------------------------------------------
  // Caja original: top=666.72 left=995.54 width=110.95 height=110.95.
  borrar(pagina, 985, 1118, 660, 790);
  {
    const qrLadoDisenio = 110.95;
    const qrLadoPt = u(qrLadoDisenio);
    const qrPng = await QRCode.toBuffer(urlVerificacionQr, {
      margin: 0,
      width: Math.round(qrLadoPt * 4), // más resolución que puntos PDF para que no se vea pixelado al imprimir
      color: { dark: "#201E1D", light: "#FFFFFF" },
    });
    const qrImagen = await pdfDoc.embedPng(qrPng);
    pagina.drawImage(qrImagen, {
      x: u(995.54),
      y: PAGE_H - u(666.72 + qrLadoDisenio),
      width: qrLadoPt,
      height: qrLadoPt,
    });
  }

  return pdfDoc.save();
}
