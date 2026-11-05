import { expect, test, type BrowserContextOptions } from "@playwright/test";
import { correrAxe, recorrerConTeclado } from "./a11y-herramientas";
import {
  adminClient,
  borrarUsuarioPorEmail,
  CURSO_FIXTURE,
  crearUsuarioConfirmado,
  limpiarDatosDeUsuario,
  obtenerSlugsCursoFixture,
} from "./supabase-admin";
import { TEMA_STORAGE_KEY } from "../src/lib/tema";

/**
 * Accesibilidad contra retrocesos (tarea "Pruebas automáticas contra
 * retrocesos"): corre en CI en cada PR y falla si en las pantallas principales
 * aparece
 *   - una violación de axe con impacto critical o serious (el contraste
 *     insuficiente es serious), o
 *   - un control que recibe foco con Tab sin indicador visible, o una trampa
 *     de teclado.
 * Tema claro y oscuro, a 375 y 1440 px. El teclado se recorre solo a 1440:
 * el anillo de foco no cambia con el ancho y el recorrido es lo más lento.
 *
 * Es la versión corta y bloqueante del barrido completo (a11y-barrido.spec.ts,
 * bajo pedido), que mira todas las pantallas y solo informa.
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-retroceso-a11y-${sufijo}@uva.test`;
const password = "Abcdefg1!x";

let usuarioId = "";
let sesion: BrowserContextOptions["storageState"];
const rutas: { anonimo: string[]; estudiante: string[] } = { anonimo: [], estudiante: [] };

const VARIANTES = [
  { tema: "oscuro", ancho: 1440, teclado: true },
  { tema: "claro", ancho: 1440, teclado: true },
  { tema: "oscuro", ancho: 375, teclado: false },
  { tema: "claro", ancho: 375, teclado: false },
] as const;

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(3 * 60_000);
  const user = await crearUsuarioConfirmado(admin, { email, password, nombre: "E2E Retroceso A11y" });
  usuarioId = user.id;

  const { data: plan, error: errPlan } = await admin.from("planes").select("id").limit(1).single();
  if (errPlan || !plan) throw new Error(`No hay plan para dar acceso: ${errPlan?.message}`);
  const { error: errSus } = await admin.from("suscripciones").insert({
    id_usuario: usuarioId,
    id_plan: plan.id,
    fecha_inicio: new Date().toISOString(),
    fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    estado: "ACTIVA",
    proveedor: "manual",
    monto_centavos: 0,
    moneda: "COP",
    acceso_manual: true,
  });
  if (errSus) throw new Error(`No pude dar acceso al estudiante: ${errSus.message}`);

  const { cursoSlug, leccionSlugs } = await obtenerSlugsCursoFixture(admin);
  const [intro, conAcceso] = CURSO_FIXTURE.lecciones;
  rutas.anonimo = ["/", "/catalogo", `/cursos/${cursoSlug}`, `/cursos/${cursoSlug}/${leccionSlugs[intro.id]}`, "/login", "/canjear"];
  rutas.estudiante = ["/dashboard", "/dashboard/catalogo", `/cursos/${cursoSlug}/${leccionSlugs[conAcceso.id]}`];

  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  sesion = await context.storageState();
  await context.close();
});

test.afterAll(async () => {
  if (usuarioId) await limpiarDatosDeUsuario(admin, usuarioId);
  await borrarUsuarioPorEmail(admin, email);
});

for (const rol of ["anonimo", "estudiante"] as const) {
  for (const v of VARIANTES) {
    test(`${rol} · ${v.tema} · ${v.ancho}px`, async ({ browser }) => {
      test.setTimeout(6 * 60_000);
      const context = await browser.newContext({
        storageState: rol === "estudiante" ? sesion : undefined,
        viewport: { width: v.ancho, height: 900 },
      });
      await context.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [TEMA_STORAGE_KEY, v.tema] as const);
      const page = await context.newPage();

      for (const ruta of rutas[rol]) {
        await page.goto(ruta, { waitUntil: "load", timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

        const { violaciones } = await correrAxe(page);
        const graves = violaciones.filter((vi) => vi.impact === "critical" || vi.impact === "serious");
        expect
          .soft(graves.map((vi) => `[${vi.impact}] ${vi.id}: ${vi.help} (${vi.total})\n    ${vi.nodos.join("\n    ")}`), `axe en ${ruta}`)
          .toEqual([]);

        if (v.teclado) {
          const t = await recorrerConTeclado(page);
          expect.soft(t.invisibles, `foco invisible en ${ruta}`).toEqual([]);
          expect.soft(t.atrapado, `trampa de teclado en ${ruta}`).toBeNull();
        }
      }
      await context.close();
    });
  }
}
