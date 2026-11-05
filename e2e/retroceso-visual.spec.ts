import { test, expect, type BrowserContextOptions, type Page } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearEstudianteConSesion,
  CURSO_FIXTURE,
  limpiarDatosDeUsuario,
  obtenerSlugsCursoFixture,
} from "./supabase-admin";
import { TEMA_STORAGE_KEY } from "../src/lib/tema";

/**
 * Pruebas visuales contra retrocesos: compara capturas de las pantallas
 * principales en 375, 768 y 1440 px, en tema claro y oscuro, contra las de
 * referencia guardadas en e2e/retroceso-visual.spec.ts-snapshots/.
 *
 * Las de referencia se generan en Linux (el runner de GitHub): fuentes y
 * suavizado cambian entre sistemas, así que en Windows o Mac esta prueba se
 * salta. Para actualizarlas cuando un cambio visual es intencional, ver
 * docs/qa/pruebas-visuales.md.
 */

test.skip(process.platform !== "linux" && !process.env.CAPTURAS_LOCAL, "Las capturas de referencia son de Linux (CI)");

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-retroceso-visual-${sufijo}@uva.test`;
const password = "Abcdefg1!x";

let usuarioId = "";
let sesion: BrowserContextOptions["storageState"];
let pantallas: { nombre: string; ruta: string; conSesion: boolean }[] = [];

const ANCHOS = [375, 768, 1440] as const;
const TEMAS = ["claro", "oscuro"] as const;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  ({ id: usuarioId, sesion } = await crearEstudianteConSesion(admin, browser, {
    email,
    password,
    nombre: "Estudiante Capturas",
  }));
  const { cursoSlug, leccionSlugs } = await obtenerSlugsCursoFixture(admin);
  const conAcceso = CURSO_FIXTURE.lecciones[1];
  pantallas = [
    { nombre: "portada", ruta: "/", conSesion: false },
    { nombre: "catalogo", ruta: "/catalogo", conSesion: false },
    { nombre: "ficha-curso", ruta: `/cursos/${cursoSlug}`, conSesion: false },
    { nombre: "login", ruta: "/login", conSesion: false },
    { nombre: "panel", ruta: "/dashboard", conSesion: true },
    { nombre: "leccion", ruta: `/cursos/${cursoSlug}/${leccionSlugs[conAcceso.id]}`, conSesion: true },
  ];
});

test.afterAll(async () => {
  if (usuarioId) await limpiarDatosDeUsuario(admin, usuarioId);
  await borrarUsuarioPorEmail(admin, email);
});

/** Lo que cambia solo con el paso del tiempo, no con el código: se tapa. */
function variables(page: Page) {
  return [
    // "Tu acceso · N días" del menú lateral y "hasta el <fecha>".
    page.locator("p", { hasText: /^Tu acceso/ }).locator(".."),
    page.getByText(/hasta el \d/),
  ];
}

for (const tema of TEMAS) {
  for (const ancho of ANCHOS) {
    test(`capturas · ${tema} · ${ancho}px`, async ({ browser }) => {
      test.setTimeout(6 * 60_000);
      for (const conSesion of [false, true]) {
        const context = await browser.newContext({
          storageState: conSesion ? sesion : undefined,
          viewport: { width: ancho, height: 900 },
          reducedMotion: "reduce",
        });
        await context.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [TEMA_STORAGE_KEY, tema] as const);
        const page = await context.newPage();

        for (const p of pantallas.filter((x) => x.conSesion === conSesion)) {
          await test.step(p.nombre, async () => {
            await page.goto(p.ruta, { waitUntil: "load" });
            await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
            // Imágenes diferidas (loading="lazy") de toda la página antes de capturarla entera.
            await page.evaluate(async () => {
              for (const img of Array.from(document.images)) img.loading = "eager";
              await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : img.decode().catch(() => {}))));
            });
            await expect.soft(page).toHaveScreenshot(`${p.nombre}-${tema}-${ancho}.png`, {
              fullPage: true,
              mask: variables(page),
            });
          });
        }
        await context.close();
      }
    });
  }
}
