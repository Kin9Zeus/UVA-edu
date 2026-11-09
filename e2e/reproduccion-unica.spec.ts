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
import { esperarTurnstile } from "./turnstile";

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
  await esperarTurnstile(page);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/(dashboard|canjear)/, { timeout: 30_000 });
  await page.goto(`/cursos/${CURSO_FIXTURE.id}/${leccion1.id}`);
  const reproductor = await reproducirVideo(page);
  await reproductor.evaluate((el) => {
    (el as HTMLMediaElement).loop = true;
  });
}

/**
 * El reproductor sigue reproduciendo (y latiendo) pero casi sin avanzar, en
 * bucle: su posición queda claramente detrás del segundo que se fija abajo.
 */
async function lentoCercaDelInicio(page: Page) {
  // Antes de que cargue el video, el reproductor ignora `currentTime` y luego
  // arranca en su `startTime`: se repite hasta que el salto de verdad quede.
  await expect
    .poll(
      () =>
        page.locator("mux-player").evaluate((el) => {
          const media = el as HTMLMediaElement;
          if (media.readyState < 1) return Infinity;
          media.loop = true;
          media.playbackRate = 0.1;
          if (media.currentTime > 2) media.currentTime = 1;
          return media.currentTime;
        }),
      { timeout: 20_000 },
    )
    .toBeLessThan(2);
}

test("el segundo dispositivo pausa al primero, y «Ver aquí» lo recupera", async ({ browser }) => {
  test.setTimeout(180_000);
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();

  await test.step("la laptop reproduce, muy lento y cerca del inicio", async () => {
    await entrarYReproducir(laptop);
    await lentoCercaDelInicio(laptop);
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
    await lentoCercaDelInicio(laptop);
  });

  await test.step("misma clase: «Ver aquí» sigue desde lo que avanzó el otro equipo", async () => {
    // La tablet vuelve a tomar la clase y "avanza" hasta el segundo 8 (se fija
    // en la base: el clip dura 10 s y su posición real depende del bucle).
    await tablet.getByRole("button", { name: "Ver aquí" }).click();
    await expect(laptop.getByText(AVISO)).toBeVisible({ timeout: 30_000 });
    await tablet.close();
    // El guardado final de la tablet (sendBeacon al cerrar) no debe llegar
    // después de fijar el segundo 8.
    await laptop.waitForTimeout(3_000);
    const { error } = await admin
      .from("progreso")
      .update({ segundo_actual: 8 })
      .eq("id_usuario", usuarioId)
      .eq("id_leccion", leccion1.id);
    expect(error).toBeNull();

    await laptop.getByRole("button", { name: "Ver aquí" }).click();
    // La posición AL ARRANCAR: más tarde el clip llega solo al segundo 8.
    const reproductor = laptop.locator("mux-player");
    await reproductor.waitFor({ timeout: 20_000 });
    const arranque = await reproductor.evaluate(
      (el) =>
        new Promise<number>((listo) => {
          const media = el as HTMLMediaElement;
          if (media.readyState >= 1 && !media.paused) listo(media.currentTime);
          else media.addEventListener("playing", () => listo(media.currentTime), { once: true });
        }),
    );
    expect(arranque).toBeGreaterThanOrEqual(7.5);
  });
});
