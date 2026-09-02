/**
 * Captura full-page screenshots de cada ruta pública en 5 anchos de
 * viewport, para revisar visualmente el responsive sin abrir cada pantalla
 * a mano en devtools.
 *
 * Uso:
 *   npm run audit:screenshots -- --base-url=http://localhost:3000
 *   npm run audit:screenshots -- --routes=/,/catalogo,/registro
 *
 * Flags:
 *   --base-url=<url>   Default: https://uva-edu-production.up.railway.app
 *   --depth=<n>        Profundidad del crawl. Default: 3
 *   --routes=<a,b,c>   Rutas específicas (separadas por coma) — se saltea el crawl
 *
 * Local, bajo demanda — no corre en CI.
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { crawlRoutes, assertBaseUrlReachable, sanitizeRouteForFilename } from "./lib/route-crawler";

const DEFAULT_BASE_URL = "https://uva-edu-production.up.railway.app";
const ANCHOS = [320, 375, 768, 1024, 1440];
const ALTO = 900;
const TIMEOUT_MS = 10_000;

function leerArg(nombre: string): string | undefined {
  const prefix = `--${nombre}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

const baseUrl = leerArg("base-url") ?? DEFAULT_BASE_URL;
const depth = Number(leerArg("depth") ?? 3);
const routesArg = leerArg("routes");

function fechaHoy(): string {
  return new Date().toISOString().slice(0, 10);
}

async function resolverRutas(): Promise<string[]> {
  if (routesArg) {
    return routesArg
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
  }

  await assertBaseUrlReachable(baseUrl);
  const { publicRoutes, authRequiredRoutes, errors } = await crawlRoutes(baseUrl, { maxDepth: depth });

  if (authRequiredRoutes.length > 0) {
    console.log(`\n${authRequiredRoutes.length} ruta(s) requieren autenticación y se excluyen:`);
    authRequiredRoutes.forEach((r) => console.log(`  - ${r}`));
  }
  if (errors.length > 0) {
    console.log(`\n${errors.length} ruta(s) fallaron durante el crawl y se excluyen:`);
    errors.forEach((e) => console.log(`  - ${e.url}: ${e.error}`));
  }

  return publicRoutes;
}

async function main() {
  console.log(`\nCapturando screenshots de ${baseUrl} en anchos: ${ANCHOS.join(", ")}px\n`);

  const rutas = await resolverRutas();
  const fecha = fechaHoy();
  const outDir = join(process.cwd(), "viewport-screenshots", fecha);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  let capturadas = 0;
  const fallidas: { ruta: string; ancho: number; error: string }[] = [];

  try {
    for (const ruta of rutas) {
      const url = new URL(ruta, baseUrl).toString();
      const subDir = join(outDir, sanitizeRouteForFilename(ruta));
      mkdirSync(subDir, { recursive: true });

      for (const ancho of ANCHOS) {
        console.log(`[screenshot] ${ruta} @ ${ancho}px`);
        try {
          await page.setViewportSize({ width: ancho, height: ALTO });
          await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT_MS });
          await page.screenshot({ path: join(subDir, `${ancho}px.png`), fullPage: true });
          capturadas += 1;
        } catch (error) {
          const mensaje = error instanceof Error ? error.message : String(error);
          fallidas.push({ ruta, ancho, error: mensaje });
          console.error(`  ❌ falló: ${mensaje.slice(0, 200)}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (fallidas.length > 0) {
    console.log("\nCapturas que fallaron:");
    fallidas.forEach((f) => console.log(`  - [${f.ancho}px] ${f.ruta}: ${f.error.slice(0, 150)}`));
  }

  console.log(
    `\n${capturadas} captura(s) OK, ${fallidas.length} fallida(s), de ${rutas.length * ANCHOS.length} intentadas.`,
  );
  console.log(`Screenshots guardados en ${outDir}\n`);

  if (fallidas.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
