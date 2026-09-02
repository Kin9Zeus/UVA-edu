/**
 * Detecta overflow horizontal (scrollWidth > clientWidth) en cada ruta
 * pública, en los mismos 5 breakpoints que viewport-screenshots.js, e
 * identifica qué elemento concreto se sale del viewport.
 *
 * Uso:
 *   npm run audit:overflow -- --base-url=http://localhost:3000
 *   npm run audit:overflow -- --routes=/,/catalogo,/registro
 *
 * Flags:
 *   --base-url=<url>   Default: https://uva-edu-production.up.railway.app
 *   --depth=<n>        Profundidad del crawl. Default: 3
 *   --routes=<a,b,c>   Rutas específicas (separadas por coma) — se saltea el crawl
 *
 * Exit code 1 si encuentra overflow en cualquier ruta/breakpoint (pensado
 * para correrse a mano como gate previo a un merge de cambios responsive,
 * no como parte de CI). Local, bajo demanda.
 */

import { chromium } from "@playwright/test";
import { crawlRoutes, assertBaseUrlReachable } from "./lib/route-crawler";

const DEFAULT_BASE_URL = "https://uva-edu-production.up.railway.app";
const ANCHOS = [320, 375, 768, 1024, 1440];
const ALTO = 900;
const TIMEOUT_MS = 10_000;

interface ElementoDesbordado {
  selector: string;
  anchoElemento: number;
  excesoPx: number;
}

function leerArg(nombre: string): string | undefined {
  const prefix = `--${nombre}=`;
  const arg = process.argv.find((a) => a.startsWith(prefix));
  return arg?.slice(prefix.length);
}

const baseUrl = leerArg("base-url") ?? DEFAULT_BASE_URL;
const depth = Number(leerArg("depth") ?? 3);
const routesArg = leerArg("routes");

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

/**
 * Corre en el contexto de la página vía page.evaluate: Playwright serializa
 * solo esta función, así que construirSelector va anidada adentro en vez de
 * ser una función de módulo aparte (no existiría del lado del browser).
 */
function encontrarElementosDesbordados(anchoViewport: number): ElementoDesbordado[] {
  function construirSelector(el: Element): string {
    if (el.id) return `#${el.id}`;

    const partes: string[] = [];
    let actual: Element | null = el;

    while (actual && actual !== document.body && partes.length < 4) {
      let parte = actual.tagName.toLowerCase();
      if (actual.classList.length > 0) {
        parte += `.${Array.from(actual.classList).slice(0, 2).join(".")}`;
      }
      partes.unshift(parte);
      actual = actual.parentElement;
    }

    return partes.join(" > ");
  }

  const encontrados: ElementoDesbordado[] = [];

  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    const rect = el.getBoundingClientRect();
    if (rect.right > anchoViewport + 1 && rect.width > 0) {
      encontrados.push({
        selector: construirSelector(el),
        anchoElemento: Math.round(rect.width),
        excesoPx: Math.round(rect.right - anchoViewport),
      });
    }
  }

  encontrados.sort((a, b) => b.excesoPx - a.excesoPx);
  return encontrados.slice(0, 3);
}

async function main() {
  console.log(`\nBuscando overflow horizontal en ${baseUrl}, breakpoints: ${ANCHOS.join(", ")}px\n`);

  const rutas = await resolverRutas();

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const hallazgos: { ruta: string; breakpoint: number; selector: string; excesoPx: number }[] = [];
  const fallidas: { ruta: string; breakpoint: number; error: string }[] = [];
  let revisadas = 0;

  try {
    for (const ruta of rutas) {
      const url = new URL(ruta, baseUrl).toString();

      for (const ancho of ANCHOS) {
        console.log(`[overflow] ${ruta} @ ${ancho}px`);
        try {
          await page.setViewportSize({ width: ancho, height: ALTO });
          await page.goto(url, { waitUntil: "networkidle", timeout: TIMEOUT_MS });

          const { scrollWidth, clientWidth } = await page.evaluate(() => ({
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
          }));

          revisadas += 1;

          if (scrollWidth > clientWidth) {
            const elementos = await page.evaluate(encontrarElementosDesbordados, clientWidth);
            for (const el of elementos) {
              hallazgos.push({ ruta, breakpoint: ancho, selector: el.selector, excesoPx: el.excesoPx });
            }
          }
        } catch (error) {
          const mensaje = error instanceof Error ? error.message : String(error);
          fallidas.push({ ruta, breakpoint: ancho, error: mensaje });
          console.error(`  ❌ falló: ${mensaje.slice(0, 200)}`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  if (hallazgos.length > 0) {
    console.log("\nOverflow horizontal encontrado:\n");
    console.table(
      hallazgos.map((h) => ({
        ruta: h.ruta,
        breakpoint: `${h.breakpoint}px`,
        selector: h.selector,
        "excede por (px)": h.excesoPx,
      })),
    );
  } else {
    console.log("\n✅ Sin overflow horizontal en ninguna ruta/breakpoint.\n");
  }

  if (fallidas.length > 0) {
    console.log("\nRevisiones que fallaron:");
    fallidas.forEach((f) => console.log(`  - [${f.breakpoint}px] ${f.ruta}: ${f.error.slice(0, 150)}`));
  }

  console.log(
    `\n${revisadas} revisión(es) OK, ${fallidas.length} fallida(s), de ${rutas.length * ANCHOS.length} intentadas.`,
  );

  if (hallazgos.length > 0 || fallidas.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
