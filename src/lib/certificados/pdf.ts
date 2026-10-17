import { readFile } from "node:fs/promises";
import path from "node:path";
import { LineCapStyle, PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { COTAS, CURVAS } from "@/lib/certificados/curvas";
import {
  FIRMAS_CERTIFICADO,
  LOGO_CERTIFICADO,
  TEXTOS_CERTIFICADO,
  lineaDatosCertificado,
} from "@/lib/certificados/diseno";

/**
 * Certificado U.V.A. — diseño «Finalista 2» (curvas de nivel) del artifact
 * «U.V.A. — Direcciones visuales», dirección visual Maqueta. El mismo para
 * todos los cursos.
 *
 * Todo es vectorial: las curvas de nivel (curvas.ts), el logo de trazo, las
 * firmas y el texto; solo el QR va como imagen. Se dibuja en las unidades
 * del lienzo de diseño (1123×794, px a 96 dpi ≈ A4 horizontal) y SCALE las
 * lleva a puntos PDF (72 dpi).
 *
 * El nombre del estudiante y el título del curso tienen largo variable: el
 * nombre se achica hasta un mínimo y luego parte en dos líneas; el curso
 * parte en líneas. El bloque de texto se arma de abajo hacia arriba desde
 * las firmas, así un nombre o un curso largo crece hacia arriba sin pisar
 * el pie.
 *
 * Fuentes (Google Fonts, licencia OFL — ver fonts/OFL-*.txt):
 * Plus Jakarta Sans Bold (nombre, curso), Inter (texto) y JetBrains Mono
 * (rótulo, código y URL).
 */

const FONTS_DIR = path.join(process.cwd(), "src/lib/certificados/fonts");

/** Unidades de diseño (px @96dpi, lienzo 1123×794) -> puntos PDF (72dpi). */
const SCALE = 0.75;
const ANCHO = 1123;
const ALTO = 794;
const PAGE_W = ANCHO * SCALE;
const PAGE_H = ALTO * SCALE;

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const TEXTO = hex("#18181B");
const TENUE = hex("#52525B");
const MAGENTA = hex("#C2005B");
const CURVA = hex("#E4E4E7");
const CURVA_FUERTE = hex("#C8C8CE");
const COTA = hex("#A1A1AA");
const BLANCO = rgb(1, 1, 1);

/** Margen del contenido: arriba 60, lados 72, abajo 52 (como el artboard). */
const IZQ = 72;
const DER = ANCHO - 72;
const ABAJO = ALTO - 52;

const LOGO = LOGO_CERTIFICADO;
const FIRMAS = FIRMAS_CERTIFICADO;

const u = (v: number) => v * SCALE;

type Texto = { font: PDFFont; size: number; color: ReturnType<typeof rgb> };

/**
 * Dibuja una línea de texto dentro de una "caja de línea" de CSS: `top` es
 * el borde superior de la línea y `alto` su line-height, en unidades de
 * diseño. La línea base queda donde la pondría el navegador (contenido
 * centrado en el alto de línea).
 */
function linea(pagina: PDFPage, texto: string, x: number, top: number, alto: number, estilo: Texto, alinear: "izq" | "der" = "izq") {
  const ascenso = estilo.font.heightAtSize(estilo.size, { descender: false });
  const total = estilo.font.heightAtSize(estilo.size);
  const base = top + (alto - total) / 2 + ascenso;
  const ancho = estilo.font.widthOfTextAtSize(texto, estilo.size);
  pagina.drawText(texto, {
    x: u(alinear === "der" ? x - ancho : x),
    y: PAGE_H - u(base),
    size: u(estilo.size),
    font: estilo.font,
    color: estilo.color,
  });
}

/** Parte un texto en líneas que caben en `anchoMax` (unidades de diseño). */
function partir(texto: string, font: PDFFont, size: number, anchoMax: number): string[] {
  const lineas: string[] = [];
  let actual = "";
  for (const palabra of texto.split(/\s+/).filter(Boolean)) {
    const prueba = actual ? `${actual} ${palabra}` : palabra;
    if (actual && font.widthOfTextAtSize(prueba, size) > anchoMax) {
      lineas.push(actual);
      actual = palabra;
    } else {
      actual = prueba;
    }
  }
  if (actual) lineas.push(actual);
  return lineas;
}

/** Trazo SVG con su origen en (x, y) de diseño (desde arriba); `escala` lleva las
 *  unidades del trazo a unidades de diseño y `grosor` va en unidades del trazo. */
function trazo(pagina: PDFPage, d: string, x: number, y: number, escala: number, color: ReturnType<typeof rgb>, grosor: number) {
  pagina.drawSvgPath(d, {
    x: u(x),
    y: PAGE_H - u(y),
    scale: u(escala),
    borderColor: color,
    // pdf-lib escala el grosor junto con el trazo: va en unidades del trazo.
    borderWidth: grosor,
    borderLineCap: LineCapStyle.Round,
  });
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
  /** Texto a imprimir (sin protocolo). */
  urlVerificacion: string;
  /** URL completa (con https://) que codifica el QR — tiene que ser la que de verdad resuelve al escanearla. */
  urlVerificacionQr: string;
}): Promise<Uint8Array> {
  const [jakartaBytes, interBytes, interSemiBytes, monoBytes, monoMedioBytes] = await Promise.all(
    ["PlusJakartaSans-Bold", "Inter-Regular", "Inter-SemiBold", "JetBrainsMono-Regular", "JetBrainsMono-Medium"].map(
      (nombre) => readFile(path.join(FONTS_DIR, `${nombre}.ttf`)),
    ),
  );

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  // calt/liga deshabilitados: pdf-lib no aplica shaping OpenType completo y
  // con esas features fontkit puede sustituir glifos con un ancho erróneo.
  // `subset`: solo las letras que se usan, no la fuente entera.
  const sinLigaduras = { subset: true, features: { calt: false, liga: false } };
  // Inter va completa: el recorte de fontkit le pierde glifos (se veían
  // letras sueltas en el PDF). Las otras dos sí se recortan sin problema.
  const completa = { features: { calt: false, liga: false } };
  const [jakarta, inter, interSemi, mono, monoMedio] = await Promise.all([
    pdfDoc.embedFont(jakartaBytes, sinLigaduras),
    pdfDoc.embedFont(interBytes, completa),
    pdfDoc.embedFont(interSemiBytes, completa),
    pdfDoc.embedFont(monoBytes, sinLigaduras),
    pdfDoc.embedFont(monoMedioBytes, sinLigaduras),
  ]);

  const pagina = pdfDoc.addPage([PAGE_W, PAGE_H]);
  pagina.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: BLANCO });

  // --- Curvas de nivel, con sus cotas y el punto de la cima ---------------
  for (const curva of CURVAS) {
    trazo(pagina, curva.d, 0, 0, 1, curva.fuerte ? CURVA_FUERTE : CURVA, curva.fuerte ? 1.4 : 1);
  }
  const cota: Texto = { font: mono, size: 11, color: COTA };
  for (const { x, y, texto } of COTAS) {
    // Halo blanco detrás de la cota (en el diseño, un trazo blanco de 4 px).
    const ancho = mono.widthOfTextAtSize(texto, cota.size);
    pagina.drawRectangle({ x: u(x - 2), y: PAGE_H - u(y + 3), width: u(ancho + 4), height: u(13), color: BLANCO });
    pagina.drawText(texto, { x: u(x), y: PAGE_H - u(y), size: u(cota.size), font: mono, color: COTA });
  }
  pagina.drawCircle({ x: u(870), y: PAGE_H - u(300), size: u(6), color: TEXTO });

  // --- Encabezado: logo de trazo + nombre de la institución ---------------
  // Logo de 25.3 de alto (1.15em de 22 px); el texto, en su línea base.
  const altoLogo = 25.3;
  trazo(pagina, LOGO, IZQ, 60, altoLogo / 48, TEXTO, 3.2);
  linea(pagina, TEXTOS_CERTIFICADO.institucion, IZQ + (128 * altoLogo) / 48 + 12, 60 + 3, 19.5, {
    font: inter,
    size: 13,
    color: TENUE,
  });

  // --- Pie: firmas a la izquierda, código y QR a la derecha ---------------
  // Cada firma: trazo de 44, línea, nombre (14/1.3) y cargo (12/1.4).
  const altoFirma = 44 + 1 + 8 + 18.2 + 16.8;
  const topFirma = ABAJO - altoFirma;
  FIRMAS.forEach((firma, i) => {
    const x = IZQ + i * (200 + 32);
    trazo(pagina, firma.trazo, x, topFirma, 1, TEXTO, 2);
    pagina.drawRectangle({ x: u(x), y: PAGE_H - u(topFirma + 45), width: u(200), height: u(1), color: TEXTO });
    linea(pagina, firma.nombre, x, topFirma + 53, 18.2, { font: interSemi, size: 14, color: TEXTO });
    linea(pagina, firma.cargo, x, topFirma + 71.2, 16.8, { font: inter, size: 12, color: TENUE });
  });

  const ladoQr = 64;
  const xQr = DER - 10 - ladoQr;
  const topQr = ABAJO - 10 - ladoQr;
  const qrPng = await QRCode.toBuffer(urlVerificacionQr, {
    margin: 0,
    width: 512, // más resolución que puntos PDF para que no se vea pixelado al imprimir
    color: { dark: "#18181B", light: "#FFFFFF" },
  });
  const qrImagen = await pdfDoc.embedPng(qrPng);
  pagina.drawRectangle({ x: u(xQr - 10), y: PAGE_H - u(ABAJO), width: u(ladoQr + 20), height: u(ladoQr + 20), color: BLANCO });
  pagina.drawImage(qrImagen, { x: u(xQr), y: PAGE_H - u(topQr + ladoQr), width: u(ladoQr), height: u(ladoQr) });
  const centroQr = topQr + ladoQr / 2;
  const xTextoQr = xQr - 12;
  const anchoUrl = mono.widthOfTextAtSize(urlVerificacion, 11);
  pagina.drawRectangle({
    x: u(xTextoQr - anchoUrl - 8),
    y: PAGE_H - u(centroQr + 22),
    width: u(anchoUrl + 8),
    height: u(44),
    color: BLANCO,
  });
  linea(pagina, codigoVerificacion, xTextoQr, centroQr - 16.8, 18.2, { font: monoMedio, size: 13, color: TEXTO }, "der");
  linea(pagina, urlVerificacion, xTextoQr, centroQr + 1.4, 15.4, { font: mono, size: 11, color: TENUE }, "der");

  // --- Bloque principal, armado de abajo hacia arriba ---------------------
  // Caja de 600 de ancho máximo con padding 20/24/20/0 y fondo blanco al 88%.
  const anchoTexto = 600 - 24;
  const datos = lineaDatosCertificado(fechaEmision, duracionTexto);

  // Nombre: 84 px; si no cabe se achica hasta 56 y, si aun así no cabe, parte.
  let tamanoNombre = 84;
  const anchoNombre = jakarta.widthOfTextAtSize(nombreEstudiante, tamanoNombre);
  if (anchoNombre > anchoTexto) tamanoNombre = Math.max(56, (tamanoNombre * anchoTexto) / anchoNombre);
  const lineasNombre = partir(nombreEstudiante, jakarta, tamanoNombre, anchoTexto);

  // Curso: 26 px en las líneas que haga falta; con más de 3 se achica.
  let tamanoCurso = 26;
  let lineasCurso = partir(cursoTitulo, jakarta, tamanoCurso, anchoTexto);
  while (lineasCurso.length > 3 && tamanoCurso > 18) {
    tamanoCurso -= 2;
    lineasCurso = partir(cursoTitulo, jakarta, tamanoCurso, anchoTexto);
  }

  const lhNombre = tamanoNombre * 0.98;
  const lhCurso = tamanoCurso * 1.2;
  const bloques: { alto: number; antes: number; dibujar: (top: number) => void }[] = [
    {
      alto: 16.8,
      antes: 0,
      dibujar: (top) => linea(pagina, TEXTOS_CERTIFICADO.tipo, IZQ, top, 16.8, { font: mono, size: 12, color: MAGENTA }),
    },
    {
      alto: 24,
      antes: 18,
      dibujar: (top) => linea(pagina, TEXTOS_CERTIFICADO.antesDelNombre, IZQ, top, 24, { font: inter, size: 16, color: TENUE }),
    },
    {
      alto: lhNombre * lineasNombre.length,
      antes: 8,
      dibujar: (top) =>
        lineasNombre.forEach((texto, i) =>
          linea(pagina, texto, IZQ, top + i * lhNombre, lhNombre, { font: jakarta, size: tamanoNombre, color: TEXTO }),
        ),
    },
    {
      alto: 24,
      antes: 24,
      dibujar: (top) =>
        linea(pagina, TEXTOS_CERTIFICADO.antesDelCurso, IZQ, top, 24, { font: inter, size: 16, color: TENUE }),
    },
    {
      alto: lhCurso * lineasCurso.length,
      antes: 6,
      dibujar: (top) =>
        lineasCurso.forEach((texto, i) =>
          linea(pagina, texto, IZQ, top + i * lhCurso, lhCurso, { font: jakarta, size: tamanoCurso, color: TEXTO }),
        ),
    },
    {
      alto: 22.5,
      antes: 14,
      dibujar: (top) => linea(pagina, datos, IZQ, top, 22.5, { font: inter, size: 15, color: TEXTO }),
    },
  ];

  const altoContenido = bloques.reduce((total, bloque) => total + bloque.antes + bloque.alto, 0);
  const finCaja = topFirma - 8 - 32; // padding-top del pie y su margen
  const inicioCaja = finCaja - 20 - altoContenido - 20;
  pagina.drawRectangle({
    x: u(IZQ),
    y: PAGE_H - u(finCaja),
    width: u(600),
    height: u(finCaja - inicioCaja),
    color: BLANCO,
    opacity: 0.88,
  });
  let top = inicioCaja + 20;
  for (const bloque of bloques) {
    top += bloque.antes;
    bloque.dibujar(top);
    top += bloque.alto;
  }

  return pdfDoc.save();
}
