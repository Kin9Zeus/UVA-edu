/**
 * Mide los Core Web Vitals de las 28 pantallas de la hoja "1_Medicion_ANTES"
 * (docs/qa/rendimiento-final-checklist.xlsx): Lighthouse móvil, N corridas por
 * pantalla, mediana, y un CSV con las columnas en el MISMO orden de la hoja,
 * listo para pegar.
 *
 * Uso:
 *   npm run audit:cwv -- --etiqueta=antes
 *   npm run audit:cwv -- --etiqueta=despues --reusar=lighthouse-baseline/cwv-2026-11-03-antes
 *
 * Flags:
 *   --base-url=<url>     Default: https://uva-edu-production.up.railway.app
 *   --etiqueta=<texto>   Nombre de la carpeta de salida (antes, despues...).
 *   --roles=a,b          publico, estudiante, admin. Default: los tres.
 *   --corridas=<n>       Corridas por pantalla. Default: 3.
 *   --solo=1,5,23        Solo esas filas de la hoja.
 *   --curso= --leccion= --categoria= --post=   Slugs fijos (si no, toma el primero que encuentra).
 *   --guardar-lhr       Guarda el reporte completo de cada corrida (lhr-<fila>-<n>.json) para ver qué scripts pesan.
 *   --reusar=<carpeta>   Usa los mismos slugs de una corrida anterior: así el
 *                        "después" mide exactamente las mismas URLs.
 *
 * Sin contraseñas en ningún archivo: las pantallas con sesión se miden
 * iniciando sesión a mano en la ventana que se abre (el admin pide además el
 * código de la app de autenticación, que no se puede automatizar). El script
 * sigue solo cuando la ventana llega a /dashboard (estudiante) o /admin.
 *
 * Mide en el equipo donde corre: el TBT sale más alto en un computador lento.
 * Compara siempre "antes" y "después" en el mismo equipo. Local, bajo demanda.
 */

import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type BrowserContext, type Page } from "@playwright/test";

type Rol = "publico" | "estudiante" | "admin";

interface Pantalla {
  fila: number;
  nombre: string;
  rol: Rol;
  /** `{curso}`, `{leccion}`, `{categoria}`, `{post}` se reemplazan por el slug. */
  ruta: string;
  metaRendimiento: number;
}

// Mismo orden y mismas metas que la hoja de Excel.
const PANTALLAS: Pantalla[] = [
  { fila: 1, nombre: "Portada", rol: "publico", ruta: "/", metaRendimiento: 90 },
  { fila: 2, nombre: "Catálogo público", rol: "publico", ruta: "/catalogo", metaRendimiento: 90 },
  { fila: 3, nombre: "Catálogo por categoría", rol: "publico", ruta: "/catalogo/{categoria}", metaRendimiento: 90 },
  { fila: 4, nombre: "Ficha de curso", rol: "publico", ruta: "/cursos/{curso}", metaRendimiento: 85 },
  { fila: 5, nombre: "Lección", rol: "estudiante", ruta: "/cursos/{curso}/{leccion}", metaRendimiento: 85 },
  { fila: 6, nombre: "Examen", rol: "estudiante", ruta: "/cursos/{curso}/examen", metaRendimiento: 85 },
  { fila: 7, nombre: "Login", rol: "publico", ruta: "/login", metaRendimiento: 90 },
  { fila: 8, nombre: "Registro", rol: "publico", ruta: "/registro", metaRendimiento: 90 },
  { fila: 9, nombre: "Canjear código", rol: "publico", ruta: "/canjear", metaRendimiento: 90 },
  { fila: 10, nombre: "Recuperar contraseña", rol: "publico", ruta: "/recuperar", metaRendimiento: 90 },
  { fila: 11, nombre: "Soporte", rol: "publico", ruta: "/soporte", metaRendimiento: 90 },
  { fila: 12, nombre: "Verificar certificado", rol: "publico", ruta: "/verificar-certificado", metaRendimiento: 90 },
  { fila: 13, nombre: "Legal", rol: "publico", ruta: "/legal/terminos", metaRendimiento: 90 },
  { fila: 14, nombre: "Inicio del panel", rol: "estudiante", ruta: "/dashboard", metaRendimiento: 85 },
  { fila: 15, nombre: "Catálogo (panel)", rol: "estudiante", ruta: "/dashboard/catalogo", metaRendimiento: 85 },
  { fila: 16, nombre: "Progreso", rol: "estudiante", ruta: "/dashboard/progreso", metaRendimiento: 85 },
  { fila: 17, nombre: "Certificados", rol: "estudiante", ruta: "/dashboard/certificados", metaRendimiento: 85 },
  { fila: 18, nombre: "Notas", rol: "estudiante", ruta: "/dashboard/notas", metaRendimiento: 85 },
  { fila: 19, nombre: "Comunidad (lista)", rol: "estudiante", ruta: "/dashboard/comunidad", metaRendimiento: 85 },
  { fila: 20, nombre: "Comunidad (post)", rol: "estudiante", ruta: "/dashboard/comunidad/{post}", metaRendimiento: 85 },
  { fila: 21, nombre: "Perfil", rol: "estudiante", ruta: "/dashboard/perfil", metaRendimiento: 85 },
  { fila: 22, nombre: "Soporte (panel)", rol: "estudiante", ruta: "/dashboard/soporte", metaRendimiento: 85 },
  { fila: 23, nombre: "Inicio admin", rol: "admin", ruta: "/admin", metaRendimiento: 85 },
  { fila: 24, nombre: "Cursos (lista)", rol: "admin", ruta: "/admin/cursos", metaRendimiento: 85 },
  { fila: 25, nombre: "Editor de curso", rol: "admin", ruta: "/admin/cursos/{curso}", metaRendimiento: 85 },
  { fila: 26, nombre: "Usuarios", rol: "admin", ruta: "/admin/usuarios", metaRendimiento: 85 },
  { fila: 27, nombre: "Códigos", rol: "admin", ruta: "/admin/codigos", metaRendimiento: 85 },
  { fila: 28, nombre: "Cupones", rol: "admin", ruta: "/admin/cupones", metaRendimiento: 85 },
];

/** Auditorías de Lighthouse que se anotan en "Qué marcó Lighthouse" si no llegan a 0,9. */
const AUDITORIAS_A_ANOTAR: Record<string, string> = {
  "render-blocking-resources": "Render-blocking",
  "unused-javascript": "JS sin usar",
  "legacy-javascript": "Legacy JS",
  "mainthread-work-breakdown": "Main-thread work",
  "bootup-time": "Tiempo de JS",
  "long-tasks": "Tareas largas",
  "server-response-time": "Respuesta del servidor",
  "bf-cache": "bfcache",
  "uses-responsive-images": "Imágenes",
  "layout-shifts": "Layout shifts",
};

const PUERTO = 9223;
const BASE_POR_DEFECTO = "https://uva-edu-production.up.railway.app";

function leerArg(nombre: string): string | undefined {
  const prefijo = `--${nombre}=`;
  return process.argv.find((a) => a.startsWith(prefijo))?.slice(prefijo.length);
}

const baseUrl = (leerArg("base-url") ?? BASE_POR_DEFECTO).replace(/\/$/, "");
const etiqueta = leerArg("etiqueta") ?? "medicion";
const roles = (leerArg("roles") ?? "publico,estudiante,admin").split(",") as Rol[];
const corridas = Number(leerArg("corridas") ?? 3);
const solo = leerArg("solo")?.split(",").map(Number);
const reusar = leerArg("reusar");
const guardarLhr = process.argv.includes("--guardar-lhr");

interface Corrida {
  rendimiento: number;
  lcp: number;
  tbt: number;
  cls: number;
  ttfb: number | null;
  avisos: string[];
}

interface ResultadoPantalla {
  fila: number;
  nombre: string;
  url: string;
  corridas: Corrida[];
}

const mediana = (v: number[]) => {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};

/** Espera a que la persona inicie sesión a mano: sigue solo cuando la ventana llega a `destino` (15 min de margen). */
async function esperarSesion(page: Page, mensaje: string, destino: RegExp) {
  console.log(`\n>>> ${mensaje}`);
  await page.waitForURL(destino, { timeout: 15 * 60_000 });
}

async function hrefs(page: Page, patron: RegExp): Promise<string[]> {
  const todos = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href") ?? ""));
  return todos.filter((h) => patron.test(h));
}

/** Slugs de las rutas dinámicas: los que se pasen por flag, los de una corrida anterior o el primero que haya. */
async function descubrirSlugs(page: Page): Promise<Record<string, string>> {
  const slugs: Record<string, string> = {};
  if (reusar) {
    const previo = join(process.cwd(), reusar, "resultados.json");
    if (existsSync(previo)) Object.assign(slugs, JSON.parse(readFileSync(previo, "utf8")).slugs);
  }
  for (const k of ["curso", "leccion", "categoria", "post"]) {
    const v = leerArg(k);
    if (v) slugs[k] = v;
  }
  if (!slugs.categoria || !slugs.curso) {
    await page.goto(`${baseUrl}/catalogo`, { waitUntil: "domcontentloaded" });
    slugs.categoria ??= (await hrefs(page, /^\/catalogo\/[^/?]+$/))[0]?.split("/")[2];
    slugs.curso ??= (await hrefs(page, /^\/cursos\/[^/?]+$/))[0]?.split("/")[2];
  }
  return slugs;
}

async function descubrirSlugsConSesion(page: Page, slugs: Record<string, string>) {
  if (!slugs.leccion && slugs.curso) {
    await page.goto(`${baseUrl}/cursos/${slugs.curso}`, { waitUntil: "domcontentloaded" });
    const enlace = (await hrefs(page, new RegExp(`^/cursos/${slugs.curso}/(?!examen)[^/?]+$`)))[0];
    slugs.leccion = enlace?.split("/")[3];
  }
  if (!slugs.post) {
    await page.goto(`${baseUrl}/dashboard/comunidad`, { waitUntil: "domcontentloaded" });
    slugs.post = (await hrefs(page, /^\/dashboard\/comunidad\/[^/?]+$/))[0]?.split("/")[3];
  }
}

function urlDe(p: Pantalla, slugs: Record<string, string>): string | null {
  let ruta = p.ruta;
  for (const [k, v] of Object.entries(slugs)) ruta = ruta.replace(`{${k}}`, v ?? "");
  // Un slug que falta deja "//" o una barra final (ej. /dashboard/comunidad/): se omite en vez de medir otra página.
  return /\{\w+\}/.test(ruta) || ruta.includes("//") || (ruta.length > 1 && ruta.endsWith("/")) ? null : baseUrl + ruta;
}

async function medir(url: string, guardarEn?: string): Promise<Corrida> {
  const { default: lighthouse } = await import("lighthouse");
  const r = await lighthouse(url, {
    port: PUERTO,
    output: "json",
    logLevel: "error",
    onlyCategories: ["performance"],
    disableStorageReset: true, // conserva la sesión iniciada
  });
  const lhr = r!.lhr;
  if (guardarEn) writeFileSync(guardarEn, JSON.stringify(lhr));
  const a = lhr.audits;
  const avisos = Object.entries(AUDITORIAS_A_ANOTAR)
    .filter(([id]) => a[id] && a[id].score !== null && (a[id].score as number) < 0.9)
    .map(([, titulo]) => titulo);
  return {
    rendimiento: Math.round((lhr.categories.performance.score ?? 0) * 100),
    lcp: Math.round(a["largest-contentful-paint"].numericValue ?? 0),
    tbt: Math.round(a["total-blocking-time"].numericValue ?? 0),
    cls: Number((a["cumulative-layout-shift"].numericValue ?? 0).toFixed(3)),
    ttfb: a["server-response-time"]?.numericValue != null ? Math.round(a["server-response-time"].numericValue) : null,
    avisos,
  };
}

async function main() {
  const hoy = new Date().toISOString().slice(0, 10);
  const salida = join(process.cwd(), "lighthouse-baseline", `cwv-${hoy}-${etiqueta}`);
  mkdirSync(salida, { recursive: true });

  const perfil = mkdtempSync(join(tmpdir(), "cwv-"));
  const contexto: BrowserContext = await chromium.launchPersistentContext(perfil, {
    headless: false,
    args: [`--remote-debugging-port=${PUERTO}`, "--disable-extensions"],
  });
  const page = contexto.pages()[0] ?? (await contexto.newPage());
  const resultados: ResultadoPantalla[] = [];
  let slugs: Record<string, string> = {};

  try {
    slugs = await descubrirSlugs(page);
    console.log("Slugs:", slugs);

    for (const rol of ["publico", "estudiante", "admin"] as Rol[]) {
      if (!roles.includes(rol)) continue;
      const pantallas = PANTALLAS.filter((p) => p.rol === rol && (!solo || solo.includes(p.fila)));
      if (!pantallas.length) continue;

      if (rol !== "publico") {
        await contexto.clearCookies();
        await page.goto(`${baseUrl}/login`);
        await esperarSesion(
          page,
          rol === "admin"
            ? "Inicia sesión como ADMINISTRADOR en la ventana (con el código de la app); sigue solo al llegar a /admin."
            : "Inicia sesión como ESTUDIANTE (con acceso al curso) en la ventana; sigue solo al llegar a /dashboard.",
          rol === "admin" ? /\/admin(\/|$)/ : /\/dashboard(\/|$)/,
        );
        if (rol === "estudiante") await descubrirSlugsConSesion(page, slugs);
      }

      for (const p of pantallas) {
        const url = urlDe(p, slugs);
        if (!url) {
          console.log(`Fila ${p.fila} ${p.nombre}: falta un slug (pásalo por flag). Se omite.`);
          continue;
        }
        const lista: Corrida[] = [];
        for (let i = 1; i <= corridas; i++) {
          try {
            lista.push(await medir(url, guardarLhr ? join(salida, `lhr-${p.fila}-${i}.json`) : undefined));
          } catch (e) {
            console.log(`  Fila ${p.fila} corrida ${i} falló: ${e instanceof Error ? e.message : e}`);
          }
        }
        resultados.push({ fila: p.fila, nombre: p.nombre, url, corridas: lista });
        const m = (k: keyof Corrida) => mediana(lista.map((c) => Number(c[k])).filter((n) => !Number.isNaN(n)));
        if (lista.length)
          console.log(
            `Fila ${String(p.fila).padStart(2)} ${p.nombre.padEnd(24)} Rend ${m("rendimiento")} | LCP ${m("lcp")} | TBT ${m("tbt")} | CLS ${m("cls")}`,
          );
      }
    }
  } finally {
    await contexto.close();
  }

  resultados.sort((a, b) => a.fila - b.fila);
  writeFileSync(join(salida, "resultados.json"), JSON.stringify({ baseUrl, slugs, resultados }, null, 2));

  // CSV en el orden de columnas de la hoja: C1 (Rend, LCP, TBT, CLS, TTFB), C2, C3, y las alertas.
  const filas = resultados.map((r) => {
    const celdas = [0, 1, 2].flatMap((i) => {
      const c = r.corridas[i];
      return c ? [c.rendimiento, c.lcp, c.tbt, String(c.cls).replace(".", ","), c.ttfb ?? ""] : ["", "", "", "", ""];
    });
    const avisos = [...new Set(r.corridas.flatMap((c) => c.avisos))].join(", ");
    return [r.fila, r.nombre, ...celdas, avisos].join(";");
  });
  writeFileSync(join(salida, "resultados.csv"), "﻿" + filas.join("\n"));
  console.log(`\nListo. ${salida}\\resultados.csv (pega las columnas C1..C3 en la hoja, desde la fila de la pantalla).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
