import { expect, test, type Page } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  CURSO_FIXTURE,
  limpiarDatosDeUsuario,
  reproducirVideo,
  verificarCursoFixture,
} from "./supabase-admin";

/**
 * Un video a la vez por cuenta (functional-spec, Flujo 05;
 * supabase/sql/136_reproduccion_unica.sql): dos navegadores con la misma
 * cuenta. Cuando el segundo empieza a reproducir, el primero se pausa en su
 * siguiente latido (~10 s) y muestra el aviso; "Ver aquí" lo recupera y
 * entonces el que se pausa es el segundo.
 *
 * Usa la lección introductoria del fixture: con sesión iniciada también
 * reclama la reproducción, y no hace falta canjear un código.
 *
 * El clip del fixture dura 10 s, lo mismo que el latido: se pone en bucle para
 * que el reproductor siga guardando (y comprobando) mientras se espera.
 */

const admin = adminClient();
const email = `e2e-unica-${Date.now()}@uva.test`;
const password = "Abcdefg1!x";
const [leccion1] = CURSO_FIXTURE.lecciones;
const AVISO = "Tu cuenta se está reproduciendo en otro dispositivo.";

let usuarioId: string;

test.beforeAll(async () => {
  await verificarCursoFixture(admin);
  usuarioId = (await crearUsuarioConfirmado(admin, { email, password })).id;
});

test.afterAll(async () => {
  await limpiarDatosDeUsuario(admin, usuarioId);
  await borrarUsuarioPorEmail(admin, email);
});

async function entrarYReproducir(page: Page) {
  await page.goto("/login");
  await page.fill("#auth-email", email);
  // Un clic antes de que la página hidrate no hace nada: se repite.
  await expect(async () => {
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#login-pass")).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/(dashboard|canjear)/, { timeout: 30_000 });
  await page.goto(`/cursos/${CURSO_FIXTURE.id}/${leccion1.id}`);
  const reproductor = await reproducirVideo(page);
  await reproductor.evaluate((el) => {
    (el as HTMLMediaElement).loop = true;
  });
}

test("el segundo dispositivo pausa al primero, y «Ver aquí» lo recupera", async ({ browser }) => {
  test.setTimeout(120_000);
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();

  await test.step("la laptop reproduce", async () => {
    await entrarYReproducir(laptop);
  });

  await test.step("la tablet reproduce y la laptop se pausa en su siguiente latido", async () => {
    await entrarYReproducir(tablet);
    await expect(laptop.getByText(AVISO)).toBeVisible({ timeout: 30_000 });
    await expect(tablet.getByText(AVISO)).toHaveCount(0);
  });

  await test.step("«Ver aquí» en la laptop pausa la tablet", async () => {
    await laptop.getByRole("button", { name: "Ver aquí" }).click();
    await expect(laptop.locator("mux-player")).toBeVisible({ timeout: 20_000 });
    await expect(tablet.getByText(AVISO)).toBeVisible({ timeout: 30_000 });
  });
});
