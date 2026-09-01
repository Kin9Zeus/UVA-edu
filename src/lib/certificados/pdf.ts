import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

/**
 * Certificado UVA — diseño real (Claude Design, proyecto "UI mockups con 12
 * pantallas", archivo "Uva - Certificado.dc.html", importado 2026-08-31).
 * Traduce ese HTML/CSS a pdf-lib punto por punto. Simplificaciones
 * deliberadas frente al original (documentadas para poder revisarlas si
 * hace falta más fidelidad):
 *   - Sin esquinas redondeadas (drawRectangle no las soporta; requeriría
 *     dibujar el marco a mano con drawSvgPath).
 *   - Sin el patrón técnico de fondo (SVG de líneas/círculos al 5-7% de
 *     opacidad) ni las firmas manuscritas decorativas sobre cada nombre —
 *     ambos puramente ornamentales, no cambian la información del
 *     certificado.
 *   - El diseño aprobado no traía QR (solo URL + código en texto); se
 *     agregó encima del bloque de verificación porque Certificado.md lo
 *     pide como mejora explícita sobre ese diseño, no como parte de él.
 *   - Las columnas de las firmas no vienen del "max-width:940px" del CSS
 *     (ese máximo nunca se alcanza: el contenedor real mide ~870px) sino
 *     de los bordes reales del área de contenido, para que no queden más
 *     pegadas al centro de lo que se ven en el mockup.
 *   - Las 3 tipografías (Plus Jakarta Sans, Inter, JetBrains Mono) se
 *     incrustan de sus archivos variables reales descargados de Google
 *     Fonts (OFL, ver los .txt junto a los .ttf en este mismo directorio),
 *     pero pdf-lib/fontkit solo puede incrustar la instancia POR DEFECTO de
 *     una variable font (Regular) — no hay forma de exportar una instancia
 *     Bold/ExtraBold como archivo estático sin herramientas adicionales
 *     (fonttools). Los títulos que el diseño pide en 700/800 se compensan
 *     con "faux bold" (el mismo texto dibujado 2 veces con un offset de
 *     0.4pt) en vez de caer a una tipografía distinta para el logo/nombre.
 */

const FONTS_DIR = path.join(process.cwd(), "src/lib/certificados/fonts");

const NEGRO = rgb(0x20 / 255, 0x1e / 255, 0x1d / 255); // #201E1D (texto principal del certificado)
const GRIS_MEDIO = rgb(0x52 / 255, 0x52 / 255, 0x5b / 255); // #52525B
const GRIS_CLARO = rgb(0x71 / 255, 0x71 / 255, 0x7a / 255); // #71717A
const GRIS_CODIGO = rgb(0xa1 / 255, 0xa1 / 255, 0xaa / 255); // #A1A1AA
const BLANCO = rgb(1, 1, 1);
const NEGRO_MARCO = rgb(0, 0, 0);

const PAGE_W = 991;
const PAGE_H = 567;

function centrarX(texto: string, font: PDFFont, size: number, centroX: number) {
  return centroX - font.widthOfTextAtSize(texto, size) / 2;
}

/** "Bold" simulado: el diseño pide 700/800 pero solo tenemos la instancia
 * Regular de la variable font (ver comentario de arriba). */
function textoConPeso(
  pagina: PDFPage,
  texto: string,
  opts: { x: number; y: number; size: number; font: PDFFont; color: ReturnType<typeof rgb> },
  negrita: boolean,
) {
  pagina.drawText(texto, opts);
  if (negrita) {
    pagina.drawText(texto, { ...opts, x: opts.x + 0.4 });
    pagina.drawText(texto, { ...opts, y: opts.y + 0.4 });
  }
}

// Provisional (pendiente de definición final de firmantes): Sebastián a la
// izquierda, Felipe a la derecha, ambos con cargo "CEO".
const FIRMANTE_IZQUIERDA = { nombre: "Sebastián Arias", cargo: "CEO" };
const FIRMANTE_DERECHA = { nombre: "Felipe Cuartas", cargo: "CEO" };

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
  /** Texto a imprimir (sin protocolo, como en el diseño: "uva.edu.co/..."). */
  urlVerificacion: string;
  /** URL completa (con https://) que codifica el QR — tiene que ser la que de verdad resuelve al escanearla. */
  urlVerificacionQr: string;
}): Promise<Uint8Array> {
  const [pjsBytes, interBytes, monoBytes] = await Promise.all([
    readFile(path.join(FONTS_DIR, "PlusJakartaSans-Variable.ttf")),
    readFile(path.join(FONTS_DIR, "Inter-Variable.ttf")),
    readFile(path.join(FONTS_DIR, "JetBrainsMono-Variable.ttf")),
  ]);

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const jakarta = await pdfDoc.embedFont(pjsBytes);
  const inter = await pdfDoc.embedFont(interBytes);
  const mono = await pdfDoc.embedFont(monoBytes);

  const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const cx = PAGE_W / 2;

  // Marco negro exterior + tarjeta blanca interior (padding: 15px).
  pagina.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: NEGRO_MARCO });
  pagina.drawRectangle({ x: 15, y: 15, width: PAGE_W - 30, height: PAGE_H - 30, color: BLANCO });

  // --- Logo "U.V.A" ---------------------------------------------------
  const logoSize = 67.16;
  const logoTopY = 38.63; // padding-top del contenido (4.4% de 537)
  textoConPeso(
    pagina,
    "U.V.A",
    { x: centrarX("U.V.A", jakarta, logoSize, cx), y: PAGE_H - logoTopY - logoSize, size: logoSize, font: jakarta, color: NEGRO },
    true,
  );

  // --- "Certifica a" / nombre / "Por participar..." -------------------
  let y = PAGE_H - 136.6;
  const certificaSize = 10.27;
  pagina.drawText("Certifica a", { x: centrarX("Certifica a", inter, certificaSize, cx), y, size: certificaSize, font: inter, color: GRIS_MEDIO });
  y -= 12.3 + 5.66;

  const nombreSize = nombreEstudiante.length > 28 ? 17 : 20.46;
  textoConPeso(pagina, nombreEstudiante, { x: centrarX(nombreEstudiante, jakarta, nombreSize, cx), y, size: nombreSize, font: jakarta, color: NEGRO }, true);
  y -= 27.6 + 5.66 + 4.35;

  const porParticiparSize = 10.27;
  pagina.drawText("Por participar y aprobar el", {
    x: centrarX("Por participar y aprobar el", inter, porParticiparSize, cx),
    y,
    size: porParticiparSize,
    font: inter,
    color: GRIS_MEDIO,
  });

  // --- "CURSO DE" / título del curso -----------------------------------
  y -= 12.3 + 20.03;
  const labelCursoSize = 10.88;
  const labelCurso = "CURSO DE";
  pagina.drawText(labelCurso, { x: centrarX(labelCurso, jakarta, labelCursoSize, cx), y, size: labelCursoSize, font: jakarta, color: GRIS_CLARO });
  y -= 13.06 + 4.35;

  const cursoSize = cursoTitulo.length > 34 ? 18 : 23.25;
  textoConPeso(pagina, cursoTitulo, { x: centrarX(cursoTitulo, jakarta, cursoSize, cx), y, size: cursoSize, font: jakarta, color: NEGRO }, true);

  // --- Pie: firmas + info de verificación (ancladas cerca del fondo) ---
  const pieBottomFirmas = 418.67; // 532.67 (fondo del contenido) - 114px de offset del diseño
  const pieBottomCentro = 515.67; // 532.67 - 17px de offset del diseño
  // Bordes reales del área de contenido (60.17 / 930.83 — ver comentario de
  // cabecera): las firmas se apoyan contra ellos, no contra el
  // "max-width:940px" del grid original, que nunca llega a aplicarse.
  const contenidoIzq = 60.17;
  const contenidoDer = PAGE_W - contenidoIzq;
  const colIzqX = contenidoIzq + 75;
  const colDerX = contenidoDer - 75;

  function firma(centroX: number, nombre: string, cargo: string) {
    const lineaY = pieBottomFirmas + 37.4;
    pagina.drawLine({
      start: { x: centroX - 75, y: PAGE_H - lineaY },
      end: { x: centroX + 75, y: PAGE_H - lineaY },
      thickness: 1,
      color: NEGRO,
    });
    const nombreSize = 13;
    pagina.drawText(nombre, { x: centrarX(nombre, inter, nombreSize, centroX), y: PAGE_H - lineaY - 8 - 11, size: nombreSize, font: inter, color: NEGRO });
    const cargoSize = 11.5;
    const cargoUpper = cargo.toUpperCase();
    textoConPeso(
      pagina,
      cargoUpper,
      { x: centrarX(cargoUpper, jakarta, cargoSize, centroX), y: PAGE_H - lineaY - 8 - 11 - 13.8, size: cargoSize, font: jakarta, color: NEGRO },
      true,
    );
  }

  firma(colIzqX, FIRMANTE_IZQUIERDA.nombre, FIRMANTE_IZQUIERDA.cargo);
  firma(colDerX, FIRMANTE_DERECHA.nombre, FIRMANTE_DERECHA.cargo);

  // Se apila de abajo hacia arriba: `bottomY` es la distancia (top-down)
  // desde el borde superior de la página hasta el borde INFERIOR de la
  // línea que falta colocar. Cada línea nueva se dibuja y luego `bottomY`
  // retrocede (se acerca al techo de la página) según su propio alto más
  // el margen que el diseño le pone a la línea de abajo.
  let bottomY = pieBottomCentro;

  const codigoSize = 10.5;
  const codigoTexto = `Código: ${codigoVerificacion}`;
  pagina.drawText(codigoTexto, { x: centrarX(codigoTexto, mono, codigoSize, cx), y: PAGE_H - bottomY, size: codigoSize, font: mono, color: GRIS_CODIGO });
  bottomY -= codigoSize * 1.2 + 3;

  const urlSize = 12;
  pagina.drawText(urlVerificacion, { x: centrarX(urlVerificacion, inter, urlSize, cx), y: PAGE_H - bottomY, size: urlSize, font: inter, color: NEGRO });
  bottomY -= urlSize * 1.2 + 8;

  if (duracionTexto) {
    const duracionSize = 12.5;
    pagina.drawText(duracionTexto, { x: centrarX(duracionTexto, inter, duracionSize, cx), y: PAGE_H - bottomY, size: duracionSize, font: inter, color: GRIS_CLARO });
    bottomY -= duracionSize * 1.2 + 2;
  }

  const fechaTexto = `Aprobado el ${fechaEmision.toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Bogota",
  })}`;
  const fechaSize = 15;
  textoConPeso(pagina, fechaTexto, { x: centrarX(fechaTexto, jakarta, fechaSize, cx), y: PAGE_H - bottomY, size: fechaSize, font: jakarta, color: NEGRO }, true);
  bottomY -= fechaSize * 1.2 + 6;

  const etiquetaSize = 11.5;
  const etiqueta = "Certificación de aprobación online:";
  pagina.drawText(etiqueta, { x: centrarX(etiqueta, inter, etiquetaSize, cx), y: PAGE_H - bottomY, size: etiquetaSize, font: inter, color: GRIS_CLARO });
  bottomY -= etiquetaSize * 1.2;

  // --- QR (no estaba en el diseño original, agregado a pedido) ----------
  const qrTamano = 62;
  const qrGap = 10;
  const qrPng = await QRCode.toBuffer(urlVerificacionQr, {
    margin: 0,
    width: qrTamano * 4, // más resolución que puntos PDF para que no se vea pixelado al imprimir
    color: { dark: "#201E1D", light: "#FFFFFF" },
  });
  const qrImagen = await pdfDoc.embedPng(qrPng);
  bottomY -= qrGap + qrTamano;
  pagina.drawImage(qrImagen, { x: cx - qrTamano / 2, y: PAGE_H - bottomY - qrTamano, width: qrTamano, height: qrTamano });

  return pdfDoc.save();
}
