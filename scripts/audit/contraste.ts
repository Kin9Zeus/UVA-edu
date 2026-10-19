/**
 * Escribe docs/contrastes.md: la tabla de contraste WCAG 2.2 de los tokens de
 * color de src/app/globals.css, en tema claro y oscuro.
 *
 * Uso:
 *   npm run audit:contraste            (reescribe la tabla)
 *   npm run audit:contraste -- --check (no escribe; sale con 1 si la tabla
 *                                        guardada no coincide o algún par falla)
 *
 * La regla vive en src/lib/diseno/contraste.ts; contraste.test.ts hace fallar
 * la suite si un par obligatorio baja de su mínimo.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  FONDOS_TEXTO,
  TOKENS_EXENTOS,
  TOKENS_TEXTO,
  leerTemas,
  medir,
  medirTodo,
  type Medicion,
  type Tema,
} from "../../src/lib/diseno/contraste";

const RAIZ = process.cwd();
const CSS = join(RAIZ, "src/app/globals.css");
const DESTINO = join(RAIZ, "docs/contrastes.md");

const css = readFileSync(CSS, "utf8");
const mediciones = medirTodo(css);
const temas = leerTemas(css);

const NOMBRE_FONDO: Record<string, string> = {
  "uva-bg": "Fondo",
  "uva-surface": "Tarjeta",
  "uva-surface-2": "Superficie 2",
  "uva-hover": "Hover",
};
const TEMAS: Tema[] = ["claro", "oscuro"];

const cifra = (r: number) => r.toFixed(2).replace(".", ",");
const celda = (m: Medicion) => (m.pasa ? cifra(m.ratio) : `**${cifra(m.ratio)} no pasa**`);
const buscar = (tema: Tema, frente: string, fondo: string) =>
  mediciones.find((m) => m.tema === tema && m.frente === frente && m.fondo === fondo)!;

function tablaTexto(tema: Tema): string {
  const cabeza = `| Token | Valor | ${FONDOS_TEXTO.map((f) => NOMBRE_FONDO[f]).join(" | ")} |`;
  const linea = `| --- | --- | ${FONDOS_TEXTO.map(() => "---:").join(" | ")} |`;
  const filas = TOKENS_TEXTO.map(
    (t) =>
      `| \`--${t}\` | \`${temas[tema][t]}\` | ${FONDOS_TEXTO.map((f) => celda(buscar(tema, t, f))).join(" | ")} |`,
  );
  return [cabeza, linea, ...filas].join("\n");
}

function tablaPares(tipo: Medicion["tipo"][]): string {
  const pares = mediciones.filter((m) => m.tema === "claro" && tipo.includes(m.tipo));
  const filas = pares.map((p) => {
    const [claro, oscuro] = TEMAS.map((tema) => buscar(tema, p.frente, p.fondo));
    return `| \`--${p.frente}\` sobre \`--${p.fondo}\` | ${cifra(p.minimo)} | ${celda(claro)} | ${celda(oscuro)} |`;
  });
  return ["| Par | Mínimo | Claro | Oscuro |", "| --- | ---: | ---: | ---: |", ...filas].join("\n");
}

function tablaExentos(): string {
  const filas = TOKENS_EXENTOS.map((t) => {
    const [claro, oscuro] = TEMAS.map((tema) =>
      cifra(medir(temas[tema], tema, { tipo: "texto", frente: t, fondo: "uva-surface", minimo: 0 }).ratio),
    );
    return `| \`--${t}\` | ${claro} | ${oscuro} |`;
  });
  return ["| Token | Claro | Oscuro |", "| --- | ---: | ---: |", ...filas].join("\n");
}

const fallas = mediciones.filter((m) => !m.pasa);

const documento = `# Tabla de contrastes

Contraste WCAG 2.2 de los tokens de color de \`src/app/globals.css\`. Este archivo lo escribe \`npm run audit:contraste\`: no se edita a mano.

Mínimos: **4,5:1** para texto normal y **3:1** para bordes de controles, foco e indicadores. Los colores con transparencia se miden ya mezclados con el fondo de abajo. Si un par obligatorio baja de su mínimo, falla \`src/lib/diseno/contraste.test.ts\`.

Estado: ${fallas.length === 0 ? "todos los pares obligatorios pasan AA en los dos temas." : `**${fallas.length} pares no pasan.**`}

## Texto sobre fondos, tema claro

${tablaTexto("claro")}

## Texto sobre fondos, tema oscuro

${tablaTexto("oscuro")}

## Texto sobre rellenos de color e insignias

${tablaPares(["relleno", "insignia"])}

## Bordes de controles y acento

Los campos de texto, selects, áreas de texto y casillas usan \`--uva-line-strong\` de borde. El magenta marca el foco y el progreso.

${tablaPares(["control"])}

## Exentos

Deshabilitados y separadores decorativos: WCAG no les pide contraste. Medidos sobre la tarjeta, solo como referencia. No se usan para texto que haya que leer ni para el borde de un control.

${tablaExentos()}
`;

if (process.argv.includes("--check")) {
  let guardado = "";
  try {
    guardado = readFileSync(DESTINO, "utf8");
  } catch {
    // Sin archivo: cuenta como desactualizado.
  }
  if (guardado !== documento) {
    console.error("docs/contrastes.md no coincide con globals.css. Corre `npm run audit:contraste`.");
    process.exit(1);
  }
} else {
  writeFileSync(DESTINO, documento);
  console.log(`Escrito ${DESTINO}`);
}

if (fallas.length > 0) {
  for (const f of fallas) {
    console.error(`${f.tema}: --${f.frente} sobre --${f.fondo} da ${cifra(f.ratio)} (mínimo ${cifra(f.minimo)})`);
  }
  process.exit(1);
}
console.log("Todos los pares obligatorios pasan AA en los dos temas.");
