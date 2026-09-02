/**
 * Corre Lighthouse (mobile y desktop) contra cada ruta pública que encuentre
 * el crawler, y guarda los reportes en /lighthouse-baseline/{fecha}/.
 *
 * Uso:
 *   npm run audit:lighthouse -- --base-url=http://localhost:3000
 *   npm run audit:lighthouse:compare
 *
 * Flags:
 *   --base-url=<url>    Default: https://uva-edu-production.up.railway.app
 *   --depth=<n>         Profundidad del crawl. Default: 3
 *   --max-routes=<n>    Límite de rutas a auditar. Default: sin límite
 *   --compare           Diffea contra el baseline más reciente anterior
 *
 * Local, bajo demanda — no corre en CI (Lighthouse contra producción o un
 * servidor local no tiene sentido como gate automático de cada PR).
 *
 * Corre `@lhci/cli collect` como subproceso una vez por ruta+modo, cada uno
 * en su propio directorio temporal (`.lighthouseci` se escribe siempre
 * relativo a cwd — ver node_modules/@lhci/utils/src/saved-reports.js), y
 * mueve el LHR resultante al baseline. chrome-launcher es flaky en Windows
 * al limpiar su perfil temporal (EPERM ocasional que tira el intento aunque
 * la auditoría ya haya terminado), por eso reintenta antes de marcar la
 * ruta como fallida.
 */

import { createRequire } from "node:module";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { crawlRoutes, assertBaseUrlReachable, sanitizeRouteForFilename } from "./lib/route-crawler";

const require = createRequire(import.meta.url);
const LHCI_CLI_PATH = require.resolve("@lhci/cli/src/cli.js");

const DEFAULT_BASE_URL = "https://uva-edu-production.up.railway.app";
const MODOS = ["mobile", "desktop"] as const;
type Modo = (typeof MODOS)[number];

interface FilaResultado {
  ruta: string;
  modo: Modo;
  "Performance": number;
  "LCP (ms)": number;
  "TBT (ms)": number;
  CLS: number;
}

function leerArg(nombre: string): string | undefined {
  const prefix = `--${nombre}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

const baseUrl = leerArg("base-url") ?? DEFAULT_BASE_URL;
const depth = Number(leerArg("depth") ?? 3);
const maxRoutesArg = leerArg("max-routes");
const maxRoutes = maxRoutesArg !== undefined ? Number(maxRoutesArg) : undefined;
const modoComparar = process.argv.includes("--compare");

function runLighthouse(url: string, modo: Modo, intentos = 2): LighthouseResultParcial {
  let ultimoError: unknown;

  for (let intento = 1; intento <= intentos; intento++) {
    const tempDir = mkdtempSync(join(tmpdir(), "lhci-"));
    const args = [LHCI_CLI_PATH, "collect", `--url=${url}`, "--numberOfRuns=1", "--no-lighthouserc"];
    if (modo === "desktop") args.push("--settings.preset=desktop");

    const resultado = spawnSync(process.execPath, args, {
      cwd: tempDir,
      encoding: "utf8",
      timeout: 120_000,
    });

    const lhciDir = join(tempDir, ".lighthouseci");
    const lhrFile = existsSync(lhciDir) ? readdirSync(lhciDir).find((f) => /^lhr-\d+\.json$/.test(f)) : undefined;

    if (resultado.status === 0 && lhrFile) {
      const lhr = JSON.parse(readFileSync(join(lhciDir, lhrFile), "utf8"));
      rmSync(tempDir, { recursive: true, force: true });
      return lhr;
    }

    ultimoError = resultado.error ?? resultado.stderr ?? resultado.stdout ?? `código de salida ${resultado.status}`;
    rmSync(tempDir, { recursive: true, force: true });
  }

  throw new Error(typeof ultimoError === "string" ? ultimoError : String(ultimoError));
}

interface LighthouseResultParcial {
  categories?: { performance?: { score?: number } };
  audits?: Record<string, { numericValue?: number } | undefined>;
}

function extraerMetricas(lhr: LighthouseResultParcial): Omit<FilaResultado, "ruta" | "modo"> {
  return {
    Performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100),
    "LCP (ms)": Math.round(lhr.audits?.["largest-contentful-paint"]?.numericValue ?? 0),
    "TBT (ms)": Math.round(lhr.audits?.["total-blocking-time"]?.numericValue ?? 0),
    CLS: Number((lhr.audits?.["cumulative-layout-shift"]?.numericValue ?? 0).toFixed(3)),
  };
}

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

function baselineDirs(): string[] {
  const base = join(process.cwd(), "lighthouse-baseline");
  if (!existsSync(base)) return [];
  return readdirSync(base)
    .filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f))
    .sort()
    .reverse();
}

function compararConBaselineAnterior(outDir: string, resultados: FilaResultado[]) {
  const fechas = baselineDirs().filter((f) => join(process.cwd(), "lighthouse-baseline", f) !== outDir);
  if (fechas.length === 0) {
    console.log("\n(No hay un baseline anterior contra el cual comparar.)\n");
    return;
  }

  const anteriorDir = join(process.cwd(), "lighthouse-baseline", fechas[0]);
  console.log(`\nComparando contra baseline del ${fechas[0]}:\n`);

  const filasComparadas = resultados.map((fila) => {
    const archivo = `${sanitizeRouteForFilename(fila.ruta)}-${fila.modo}.json`;
    const rutaAnterior = join(anteriorDir, archivo);
    if (!existsSync(rutaAnterior)) {
      return { ruta: fila.ruta, modo: fila.modo, "Δ Performance": "n/a", "Δ LCP (ms)": "n/a" };
    }
    const lhrAnterior = JSON.parse(readFileSync(rutaAnterior, "utf8"));
    const metricasAnteriores = extraerMetricas(lhrAnterior);
    return {
      ruta: fila.ruta,
      modo: fila.modo,
      "Δ Performance": fila.Performance - metricasAnteriores.Performance,
      "Δ LCP (ms)": fila["LCP (ms)"] - metricasAnteriores["LCP (ms)"],
    };
  });

  console.table(filasComparadas);
}

async function main() {
  console.log(`\nAuditando ${baseUrl} (Lighthouse mobile + desktop)\n`);
  await assertBaseUrlReachable(baseUrl);

  const { publicRoutes, authRequiredRoutes, errors: erroresCrawl } = await crawlRoutes(baseUrl, { maxDepth: depth });

  if (authRequiredRoutes.length > 0) {
    console.log(`\n${authRequiredRoutes.length} ruta(s) requieren autenticación y se excluyen:`);
    authRequiredRoutes.forEach((r) => console.log(`  - ${r}`));
  }

  const rutas = maxRoutes !== undefined ? publicRoutes.slice(0, maxRoutes) : publicRoutes;

  if (rutas.length > 20) {
    console.log(`\n⚠️  Se van a auditar ${rutas.length} rutas × 2 modos — esto puede tardar varios minutos.\n`);
  }

  const fecha = fechaHoy();
  const outDir = join(process.cwd(), "lighthouse-baseline", fecha);
  mkdirSync(outDir, { recursive: true });

  const resultados: FilaResultado[] = [];
  const fallidos: { ruta: string; modo: Modo; error: string }[] = [];

  for (const ruta of rutas) {
    const url = new URL(ruta, baseUrl).toString();

    for (const modo of MODOS) {
      console.log(`[lighthouse] ${modo} — ${ruta}`);
      try {
        const lhr = runLighthouse(url, modo);
        const metricas = extraerMetricas(lhr);
        resultados.push({ ruta, modo, ...metricas });

        const archivo = `${sanitizeRouteForFilename(ruta)}-${modo}.json`;
        writeFileSync(join(outDir, archivo), JSON.stringify(lhr, null, 2));
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        fallidos.push({ ruta, modo, error: mensaje });
        console.error(`  ❌ falló: ${mensaje.slice(0, 200)}`);
      }
    }
  }

  resultados.sort((a, b) => a.Performance - b.Performance);

  console.log("\nResumen (peor Performance primero):\n");
  console.table(resultados.map(({ ruta, modo, ...resto }) => ({ ruta, modo, ...resto })));

  if (fallidos.length > 0) {
    console.log("\nRutas que fallaron:");
    fallidos.forEach((f) => console.log(`  - [${f.modo}] ${f.ruta}: ${f.error.slice(0, 150)}`));
  }
  if (erroresCrawl.length > 0) {
    console.log("\nErrores durante el crawl (rutas no incluidas en la auditoría):");
    erroresCrawl.forEach((e) => console.log(`  - ${e.url}: ${e.error}`));
  }

  console.log(
    `\n${resultados.length} auditoría(s) OK, ${fallidos.length} fallida(s), de ${rutas.length * MODOS.length} intentadas.`,
  );
  console.log(`Reportes guardados en ${outDir}\n`);

  if (modoComparar) {
    compararConBaselineAnterior(outDir, resultados);
  }

  if (fallidos.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
