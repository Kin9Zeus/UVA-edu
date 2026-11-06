/**
 * Paso de CI tras `lhci autorun` (job `lighthouse`): los mínimos de
 * lighthouserc.json son avisos y no bloquean, así que esto los hace visibles.
 * Escribe una tabla en el resumen de la corrida y una advertencia (GitHub la
 * muestra en el PR) por cada categoría bajo su mínimo. Lee la corrida
 * representativa (mediana) de cada página en lighthouse-ci/manifest.json.
 */
import { appendFileSync, readFileSync } from "node:fs";

const MINIMOS = { performance: 85, accessibility: 95, "best-practices": 95, seo: 95 };
const NOMBRES = { performance: "Rendimiento", accessibility: "Accesibilidad", "best-practices": "Buenas prácticas", seo: "SEO" };

const filas = JSON.parse(readFileSync("lighthouse-ci/manifest.json", "utf8")).filter((r) => r.isRepresentativeRun);
let md = `### Lighthouse (móvil, mediana de 3)\n\n| Página | ${Object.values(NOMBRES).join(" | ")} |\n|---|---|---|---|---|\n`;
for (const r of filas) {
  const ruta = new URL(r.url).pathname;
  const celdas = Object.keys(MINIMOS).map((k) => {
    const v = Math.round(r.summary[k] * 100);
    if (v >= MINIMOS[k]) return String(v);
    console.log(`::warning title=Lighthouse: ${NOMBRES[k]} bajo ${MINIMOS[k]}::${ruta} dio ${v}`);
    return `⚠️ ${v}`;
  });
  md += `| ${ruta} | ${celdas.join(" | ")} |\n`;
}
md += "\nMínimos: Rendimiento 85, Accesibilidad 95, Buenas prácticas 95, SEO 95. Son avisos: no bloquean el PR.\n";
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else console.log(md);
