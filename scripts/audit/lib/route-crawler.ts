/**
 * Crawler compartido por los scripts de scripts/audit/ (lighthouse-audit,
 * viewport-screenshots, overflow-detector). Descubre rutas navegando la app
 * real con Playwright en vez de mantener una lista de rutas a mano que se
 * desactualiza cada vez que se agrega una pantalla.
 *
 * No sigue rutas que requieran sesión: el layout de /dashboard y /admin
 * redirige a /login cuando no hay usuario (ver
 * src/app/(student)/dashboard/layout.tsx y src/app/(admin)/admin/layout.tsx),
 * así que cualquier URL que termine ahí se reporta aparte en
 * `authRequiredRoutes` en vez de auditarse como si fuera pública.
 */

import { chromium } from "@playwright/test";

export interface RouteCrawlOptions {
  /** Profundidad máxima de saltos de enlace desde baseUrl. Default: 3. */
  maxDepth?: number;
  /** Timeout por navegación, en ms. Default: 10000. */
  timeoutMs?: number;
  /** Patrones (contra pathname+search) que excluyen una ruta del crawl. */
  excludePatterns?: RegExp[];
  /** Patrón (contra pathname) que identifica la pantalla de login. */
  loginPathPattern?: RegExp;
}

export interface RouteCrawlResult {
  publicRoutes: string[];
  authRequiredRoutes: string[];
  errors: { url: string; error: string }[];
}

const DEFAULT_EXCLUDE_PATTERNS: RegExp[] = [
  /^\/api(\/|$)/,
  /^\/_next(\/|$)/,
  /[?&](logout|reset)(=|&|$)/i,
];

const DEFAULT_LOGIN_PATH_PATTERN = /^\/login(\/|$)/;

const IGNORED_HREF_PREFIXES = ["#", "mailto:", "tel:", "javascript:"];

/**
 * Recorre baseUrl en BFS siguiendo <a href> del mismo origin y devuelve las
 * rutas públicas encontradas, las que requieren autenticación, y los errores
 * de navegación.
 */
export async function crawlRoutes(
  baseUrl: string,
  options: RouteCrawlOptions = {},
): Promise<RouteCrawlResult> {
  const maxDepth = options.maxDepth ?? 3;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const excludePatterns = options.excludePatterns ?? DEFAULT_EXCLUDE_PATTERNS;
  const loginPathPattern = options.loginPathPattern ?? DEFAULT_LOGIN_PATH_PATTERN;

  const origin = new URL(baseUrl).origin;
  const rootPath = toRoutePath(new URL(baseUrl));

  const visited = new Set<string>([rootPath]);
  const publicRoutes: string[] = [];
  const authRequiredRoutes: string[] = [];
  const errors: { url: string; error: string }[] = [];

  const queue: { path: string; depth: number }[] = [{ path: rootPath, depth: 0 }];

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) break;
      const { path: routePath, depth } = item;
      const url = new URL(routePath, origin).toString();

      console.log(`[crawl] (${visited.size} vista(s)) ${routePath} — profundidad ${depth}`);

      let response;
      try {
        response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      } catch (error) {
        errors.push({ url: routePath, error: error instanceof Error ? error.message : String(error) });
        continue;
      }

      const finalUrl = new URL(page.url());

      if (loginPathPattern.test(finalUrl.pathname) && !loginPathPattern.test(new URL(url).pathname)) {
        authRequiredRoutes.push(routePath);
        continue;
      }

      if (response && response.status() >= 400) {
        errors.push({ url: routePath, error: `HTTP ${response.status()}` });
        continue;
      }

      publicRoutes.push(routePath);

      if (depth >= maxDepth) continue;

      const hrefs = await page.$$eval("a[href]", (anchors) =>
        anchors.map((a) => a.getAttribute("href") ?? ""),
      );

      for (const href of hrefs) {
        if (!href || IGNORED_HREF_PREFIXES.some((prefix) => href.startsWith(prefix))) continue;

        let resolved: URL;
        try {
          resolved = new URL(href, url);
        } catch {
          continue;
        }

        if (resolved.origin !== origin) continue;

        const childPath = toRoutePath(resolved);
        if (excludePatterns.some((pattern) => pattern.test(childPath))) continue;
        if (visited.has(childPath)) continue;

        visited.add(childPath);
        queue.push({ path: childPath, depth: depth + 1 });
      }
    }
  } finally {
    await browser.close();
  }

  return { publicRoutes, authRequiredRoutes, errors };
}

function toRoutePath(url: URL): string {
  return `${url.pathname}${url.search}` || "/";
}

/** Convierte una ruta ("/catalogo/programacion?x=1") en un nombre de archivo seguro. */
export function sanitizeRouteForFilename(routePath: string): string {
  const sanitized = routePath.replace(/^\/+/, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "home";
}

/**
 * Falla con un mensaje claro si baseUrl no responde, en vez de dejar que el
 * crawler lo trague silenciosamente como un error más en `errors[]`.
 */
export async function assertBaseUrlReachable(baseUrl: string, timeoutMs = 10_000): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await fetch(baseUrl, { signal: controller.signal });
  } catch (error) {
    const detalle = error instanceof Error ? error.message : String(error);
    throw new Error(`No se pudo conectar a ${baseUrl}: ${detalle}`);
  } finally {
    clearTimeout(timer);
  }
}
