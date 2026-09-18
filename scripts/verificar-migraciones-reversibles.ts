/**
 * Falla si una migración de Prisma nueva (respecto a la rama base) contiene
 * un DROP/RENAME sobre una columna o tabla — la regla de
 * docs/ops/plan-de-reversion.md: "las migraciones no se revierten solas,
 * toda migración debe ser compatible hacia atrás durante la ventana de
 * lanzamiento". Railway revierte el CÓDIGO al hacer rollback (vuelve a
 * servir el build anterior), nunca la base de datos — si una migración ya
 * aplicada borró o renombró algo que el código viejo todavía espera, el
 * rollback deja la app rota en vez de arreglarla.
 *
 * Uso: npm run verificar:migraciones-reversibles [rama-base]
 * (rama-base por defecto: origin/master)
 *
 * Solo mira LÍNEAS AGREGADAS del diff — una migración vieja que ya tenía
 * un DROP (de antes de esta regla) no debe romper el chequeo para siempre;
 * lo que importa es no agregar una nueva.
 *
 * P3-4 (AUDIT-2026-09-15.md): además de los patrones que BLOQUEAN (arriba),
 * hay una segunda clase de riesgo que este gate solo ADVIERTE, sin fallar
 * el build: `UPDATE`/`SET NOT NULL` sobre una tabla completa bloquean esa
 * tabla (lock) por un tiempo proporcional a su tamaño — inofensivo con la
 * tabla chica de hoy, no necesariamente con la de mañana. No se puede
 * bloquear en duro: `SET NOT NULL` en una tabla de catálogo de 5 filas es
 * completamente normal y no debe frenar un PR. Es una advertencia para que
 * quien revisa decida con la migración a la vista, no una regla automática.
 */

import { execSync } from "node:child_process";

const ramaBase = process.argv[2] ?? "origin/master";

const PATRONES_PELIGROSOS: Array<{ nombre: string; regex: RegExp }> = [
  { nombre: "DROP COLUMN", regex: /drop\s+column/i },
  { nombre: "DROP TABLE", regex: /drop\s+table/i },
  { nombre: "RENAME COLUMN", regex: /rename\s+column/i },
  { nombre: "RENAME TO / RENAME TABLE", regex: /rename\s+to|rename\s+table/i },
];

// No bloquean el build — ver el comentario de P3-4 arriba.
const PATRONES_ADVERTENCIA: Array<{ nombre: string; regex: RegExp }> = [
  { nombre: "SET NOT NULL", regex: /set\s+not\s+null/i },
  { nombre: "UPDATE de tabla completa", regex: /^\s*update\s+/i },
];

function ejecutar(comando: string): string {
  return execSync(comando, { encoding: "utf-8" });
}

function main() {
  let diff: string;
  try {
    diff = ejecutar(`git diff --unified=0 "${ramaBase}"...HEAD -- prisma/migrations`);
  } catch (error) {
    console.error(`\n❌ No pude diffear contra "${ramaBase}": ${error instanceof Error ? error.message : error}`);
    console.error("   (¿el checkout tiene fetch-depth: 0 / la rama base está disponible?)\n");
    process.exit(1);
  }

  if (!diff.trim()) {
    console.log(`\n✅ Sin migraciones nuevas respecto a ${ramaBase}.\n`);
    return;
  }

  const hallazgos: string[] = [];
  const advertencias: string[] = [];
  let archivoActual = "";

  for (const linea of diff.split("\n")) {
    if (linea.startsWith("+++ b/")) {
      archivoActual = linea.slice(6);
      continue;
    }
    // Solo líneas agregadas (+...), nunca las de contexto ni el propio "+++".
    if (!linea.startsWith("+") || linea.startsWith("+++")) continue;

    for (const { nombre, regex } of PATRONES_PELIGROSOS) {
      if (regex.test(linea)) {
        hallazgos.push(`${archivoActual}: ${nombre} → ${linea.slice(1).trim()}`);
      }
    }
    for (const { nombre, regex } of PATRONES_ADVERTENCIA) {
      if (regex.test(linea)) {
        advertencias.push(`${archivoActual}: ${nombre} → ${linea.slice(1).trim()}`);
      }
    }
  }

  if (advertencias.length > 0) {
    console.warn(
      `\n⚠️  ${advertencias.length} sentencia(s) que bloquean la tabla (lock) por tiempo proporcional a su tamaño — revisar si la tabla es lo bastante grande para importar (P3-4, AUDIT-2026-09-15.md):\n`,
    );
    for (const advertencia of advertencias) {
      console.warn(`   - ${advertencia}`);
    }
    console.warn(
      "\n   No bloquea el build: en una tabla chica es normal y no amerita nada más.\n" +
        "   En una tabla grande, preferir el patrón de dos pasos (agregar el CHECK\n" +
        "   NOT VALID, validarlo aparte, y recién ahí SET NOT NULL) o hacer el UPDATE\n" +
        "   por lotes.\n",
    );
  }

  if (hallazgos.length === 0) {
    console.log(`\n✅ Las migraciones nuevas respecto a ${ramaBase} no borran ni renombran nada.\n`);
    return;
  }

  console.error(`\n❌ ${hallazgos.length} migración(es) nueva(s) con DROP/RENAME — no son compatibles hacia atrás:\n`);
  for (const hallazgo of hallazgos) {
    console.error(`   - ${hallazgo}`);
  }
  console.error(
    "\n   Ver docs/ops/plan-de-reversion.md: agregar columnas/tablas nuevas en vez de\n" +
      "   renombrar o borrar las existentes durante la ventana de lanzamiento. Si el\n" +
      "   DROP/RENAME es intencional y ya se decidió asumir el riesgo, es una excepción\n" +
      "   consciente — coordinar con quien decide reversiones antes de mergear.\n",
  );
  process.exit(1);
}

main();
