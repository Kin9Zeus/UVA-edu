/**
 * Excel en español espera `;` como separador: con coma mete toda la fila en
 * una sola columna.
 */
export const SEPARADOR_CSV = ";";

/**
 * Marca de orden de bytes. Sin ella Excel abre el archivo con la codificación
 * del sistema y las tildes salen rotas.
 */
export const BOM_UTF8 = "﻿";

/** Caracteres que Excel interpreta como inicio de fórmula. */
const PREFIJOS_FORMULA = /^[=+\-@\t\r]/;

/**
 * Escapa un valor para CSV y neutraliza la inyección de fórmulas.
 *
 * Un valor que empieza por `=`, `+`, `-`, `@`, tab o retorno de carro lo
 * ejecuta Excel como fórmula al abrir el archivo. En una exportación de
 * usuarios el `nombre` lo escribe el propio usuario, así que es entrada no
 * confiable: alguien registrado como `=HYPERLINK("http://malo","Reclama")`
 * convertiría el CSV en un ataque contra quien lo abra.
 *
 * El apóstrofo delante fuerza a Excel a tratar la celda como texto. Las
 * comillas dobles se duplican, que es el escapado estándar (RFC 4180).
 */
export function celdaCsv(valor: string | number | null | undefined): string {
  const texto = valor === null || valor === undefined ? "" : String(valor);
  const neutralizado = PREFIJOS_FORMULA.test(texto) ? `'${texto}` : texto;
  return `"${neutralizado.replace(/"/g, '""')}"`;
}

/**
 * Une cabeceras y filas en un CSV listo para descargar, con BOM.
 * CRLF como fin de línea, que es lo que espera Excel.
 */
export function construirCsv(cabeceras: readonly string[], filas: readonly (string | number | null)[][]): string {
  const lineas = [
    cabeceras.map(celdaCsv).join(SEPARADOR_CSV),
    ...filas.map((fila) => fila.map(celdaCsv).join(SEPARADOR_CSV)),
  ];
  return BOM_UTF8 + lineas.join("\r\n");
}
