import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";

/**
 * Diseño PLACEHOLDER a propósito (Certificado.md, "el diseño debe llevar
 * identidad de UVA" sigue pendiente — el equipo de diseño lo está haciendo
 * aparte). Esta función es el único lugar que hay que reemplazar cuando
 * llegue ese handoff: la firma no cambia, solo su cuerpo.
 *
 * Usa las 14 fuentes estándar de PDF (Helvetica) en vez de un archivo .ttf:
 * son parte de la especificación PDF y todo lector las renderiza igual sin
 * necesidad de incrustar el programa de la fuente, así que ya cumple "no se
 * rompe en otro equipo sin las fuentes instaladas" (Certificado.md, criterio
 * de terminado). Cuando lleguen los archivos reales de Plus Jakarta Sans /
 * Inter, cambia a `pdfDoc.registerFontkit(fontkit)` +
 * `pdfDoc.embedFont(bytesDelTtf)` en vez de `pdfDoc.embedFont(StandardFonts...)`
 * — el resto (QR, código, layout) no depende de la fuente.
 */
export async function construirCertificadoPdf({
  nombreEstudiante,
  cursoTitulo,
  fechaEmision,
  codigoVerificacion,
  urlVerificacion,
}: {
  nombreEstudiante: string;
  cursoTitulo: string;
  fechaEmision: Date;
  codigoVerificacion: string;
  urlVerificacion: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const pagina = pdfDoc.addPage([842, 595]); // A4 horizontal (puntos)
  const { width, height } = pagina.getSize();

  const heading = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const cuerpo = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const mono = await pdfDoc.embedFont(StandardFonts.Courier);

  const fondo = rgb(0x09 / 255, 0x09 / 255, 0x0b / 255); // Zinc 950 (CLAUDE.md §3.3)
  const borde = rgb(0x27 / 255, 0x27 / 255, 0x2a / 255); // Zinc 800
  const acento = rgb(0xff / 255, 0x00 / 255, 0x7a / 255); // Magenta UVA
  const texto = rgb(0xfa / 255, 0xfa / 255, 0xfa / 255);
  const textoMuted = rgb(0xa1 / 255, 0xa1 / 255, 0xaa / 255);

  pagina.drawRectangle({ x: 0, y: 0, width, height, color: fondo });
  pagina.drawRectangle({
    x: 24,
    y: 24,
    width: width - 48,
    height: height - 48,
    borderColor: acento,
    borderWidth: 1.5,
  });
  pagina.drawRectangle({
    x: 34,
    y: 34,
    width: width - 68,
    height: height - 68,
    borderColor: borde,
    borderWidth: 1,
  });

  pagina.drawText("U . V . A", {
    x: width / 2 - heading.widthOfTextAtSize("U . V . A", 22) / 2,
    y: height - 100,
    size: 22,
    font: heading,
    color: acento,
  });

  pagina.drawText("CERTIFICADO DE FINALIZACIÓN", {
    x: width / 2 - cuerpo.widthOfTextAtSize("CERTIFICADO DE FINALIZACIÓN", 12) / 2,
    y: height - 130,
    size: 12,
    font: cuerpo,
    color: textoMuted,
  });

  pagina.drawText("Se otorga el presente certificado a", {
    x: width / 2 - cuerpo.widthOfTextAtSize("Se otorga el presente certificado a", 13) / 2,
    y: height - 220,
    size: 13,
    font: cuerpo,
    color: textoMuted,
  });

  const tamanoNombre = nombreEstudiante.length > 30 ? 28 : 34;
  pagina.drawText(nombreEstudiante, {
    x: width / 2 - heading.widthOfTextAtSize(nombreEstudiante, tamanoNombre) / 2,
    y: height - 260,
    size: tamanoNombre,
    font: heading,
    color: texto,
  });

  const lineaCurso = `por haber completado el curso "${cursoTitulo}"`;
  pagina.drawText(lineaCurso, {
    x: width / 2 - cuerpo.widthOfTextAtSize(lineaCurso, 14) / 2,
    y: height - 310,
    size: 14,
    font: cuerpo,
    color: texto,
  });

  const lineaFecha = `Emitido el ${fechaEmision.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  })}`;
  pagina.drawText(lineaFecha, {
    x: width / 2 - cuerpo.widthOfTextAtSize(lineaFecha, 11) / 2,
    y: height - 340,
    size: 11,
    font: cuerpo,
    color: textoMuted,
  });

  // QR + código + URL corta, todo impreso (Certificado.md: "URL de
  // verificación corta y legible... idealmente también como código QR").
  const qrPng = await QRCode.toBuffer(urlVerificacion, {
    margin: 1,
    width: 120,
    color: { dark: "#FAFAFA", light: "#09090B00" },
  });
  const qrImagen = await pdfDoc.embedPng(qrPng);
  const qrTamano = 90;
  pagina.drawImage(qrImagen, {
    x: width - 34 - 40 - qrTamano,
    y: 55,
    width: qrTamano,
    height: qrTamano,
  });

  pagina.drawText("Código de verificación", {
    x: 60,
    y: 110,
    size: 10,
    font: cuerpo,
    color: textoMuted,
  });
  pagina.drawText(codigoVerificacion, {
    x: 60,
    y: 90,
    size: 16,
    font: mono,
    color: acento,
  });
  pagina.drawText(urlVerificacion, {
    x: 60,
    y: 68,
    size: 10,
    font: mono,
    color: textoMuted,
  });

  return pdfDoc.save();
}
