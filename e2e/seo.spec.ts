import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * SEO contra retrocesos (SEO fase 14, tarea «pruebas automáticas de SEO en
 * CI»): corre en CI en cada PR, contra el build de producción y staging.
 *
 * Solo peticiones HTTP, sin navegador: lo que importa es el HTML que recibe un
 * buscador. Las páginas públicas salen del propio sitemap, así que cada curso
 * y escuela nuevos quedan cubiertos sin tocar esta prueba.
 *
 * Qué rompe la prueba:
 *   - una página pública sin 200, sin `lang="es"`, con 0 o varios `<h1>`, sin
 *     título o descripción en `<head>`, con título o descripción repetidos en
 *     otra página, sin canónica absoluta al dominio, con JSON-LD ilegible o con
 *     `noindex`;
 *   - una pantalla con `noindex` bloqueada en robots.txt (Google no podría
 *     leer el `noindex`) o sin `noindex`;
 *   - una ruta con sesión que deje de estar bloqueada en robots.txt;
 *   - una página que no existe y no responda 404 (soft 404).
 */

const SITIO = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const SIN_INDEXAR = [
  "/login",
  "/recuperar",
  "/actualizar-password",
  "/verificar-correo",
  "/verificar-certificado",
  "/acceso-denegado",
  "/canjear",
  "/cuenta-eliminada",
];
const CON_SESION = ["/dashboard", "/admin", "/seguridad", "/api", "/vista-previa", "/auth"];
// Cursos que crean test:rls y las pruebas e2e en staging: comparten título o
// descripción de relleno a propósito. Se les aplican todas las reglas menos la
// de no repetirse.
const DATOS_DE_PRUEBA = /rls-test|e2e-/;
const INEXISTENTES = ["/cursos/no-existe-seo-ci", "/catalogo/no-existe-seo-ci", "/legal/no-existe-seo-ci", "/no-existe-seo-ci"];

const head = (html: string) => html.slice(0, html.indexOf("</head>"));
const atributo = (html: string, patron: RegExp) => html.match(patron)?.[1];
const titulo = (html: string) => atributo(head(html), /<title>([^<]*)<\/title>/);
const descripcion = (html: string) => atributo(head(html), /<meta name="description" content="([^"]*)"/);
const canonica = (html: string) => atributo(head(html), /<link rel="canonical" href="([^"]*)"/);
const robotsMeta = (html: string) => atributo(html, /<meta name="robots" content="([^"]*)"/) ?? "";

async function html(request: APIRequestContext, ruta: string) {
  const res = await request.get(ruta, { maxRedirects: 0 });
  return { estado: res.status(), cuerpo: await res.text() };
}

async function rutasDelSitemap(request: APIRequestContext) {
  const xml = await (await request.get("/sitemap.xml")).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
}

/** Reglas `Disallow` del grupo `*` de robots.txt. */
async function bloqueadas(request: APIRequestContext) {
  const txt = await (await request.get("/robots.txt")).text();
  const grupo = txt.split(/\n\s*\n/).find((g) => /User-Agent:\s*\*/i.test(g)) ?? "";
  return [...grupo.matchAll(/^Disallow:\s*(\S+)/gim)].map((m) => m[1]);
}

test.describe("SEO de las páginas públicas", () => {
  test("cada página del sitemap es indexable y tiene sus metadatos completos y únicos", async ({ request }) => {
    const rutas = await rutasDelSitemap(request);
    expect(rutas.length, "el sitemap no trae páginas").toBeGreaterThan(2);

    const titulos = new Map<string, string>();
    const descripciones = new Map<string, string>();

    for (const ruta of rutas) {
      const { estado, cuerpo } = await html(request, ruta);
      await test.step(ruta, () => {
        expect.soft(estado, `${ruta}: estado`).toBe(200);
        expect.soft(cuerpo, `${ruta}: lang`).toMatch(/<html[^>]* lang="es"/);
        expect.soft((cuerpo.match(/<h1[\s>]/g) ?? []).length, `${ruta}: cantidad de <h1>`).toBe(1);
        expect.soft(robotsMeta(cuerpo), `${ruta}: no debe tener noindex`).not.toContain("noindex");

        const t = titulo(cuerpo);
        const d = descripcion(cuerpo);
        expect.soft(t, `${ruta}: <title> en <head>`).toBeTruthy();
        expect.soft(d, `${ruta}: meta descripción en <head>`).toBeTruthy();
        const unico = !DATOS_DE_PRUEBA.test(ruta);
        if (t && unico) {
          expect.soft(titulos.get(t), `${ruta}: título repetido «${t}»`).toBeUndefined();
          titulos.set(t, ruta);
        }
        if (d && unico) {
          expect.soft(descripciones.get(d), `${ruta}: descripción repetida`).toBeUndefined();
          descripciones.set(d, ruta);
        }

        const c = canonica(cuerpo);
        expect.soft(c, `${ruta}: canónica absoluta al dominio`).toMatch(new RegExp(`^${SITIO.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$)`));

        for (const [, bloque] of cuerpo.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
          let datos: unknown;
          expect.soft(() => (datos = JSON.parse(bloque)), `${ruta}: JSON-LD ilegible`).not.toThrow();
          const nodos = [datos].flat() as Record<string, unknown>[];
          for (const nodo of nodos) {
            expect.soft(nodo?.["@context"] ?? nodo?.["@graph"], `${ruta}: JSON-LD sin @context`).toBeTruthy();
          }
        }
      });
    }
  });
});

test.describe("Indexación de lo privado", () => {
  test("las pantallas sin indexar llevan noindex y robots.txt no las bloquea", async ({ request }) => {
    const disallow = await bloqueadas(request);
    for (const ruta of SIN_INDEXAR) {
      expect.soft(disallow.some((d) => ruta.startsWith(d)), `${ruta}: bloqueada en robots, Google no lee su noindex`).toBe(false);
      const { estado, cuerpo } = await html(request, ruta);
      // Algunas redirigen sin sesión (verificar-correo, actualizar-password):
      // un 3xx tampoco se indexa.
      if (estado >= 300 && estado < 400) continue;
      expect.soft(robotsMeta(cuerpo), `${ruta}: falta noindex`).toContain("noindex");
    }
  });

  test("las rutas con sesión están bloqueadas en robots.txt", async ({ request }) => {
    const disallow = await bloqueadas(request);
    for (const ruta of CON_SESION) expect.soft(disallow, `${ruta}: no está en Disallow`).toContain(ruta);
  });

  test("una página que no existe responde 404, no 200 (soft 404)", async ({ request }) => {
    for (const ruta of INEXISTENTES) {
      expect.soft((await html(request, ruta)).estado, ruta).toBe(404);
    }
  });
});
