import { expect, test, type Page } from "@playwright/test";
import {
  adminClient,
  borrarCodigoInvitacion,
  borrarUsuarioPorEmail,
  crearCodigoInvitacion,
  crearUsuarioConfirmado,
  formatearCodigoDePrueba,
  limpiarDatosDeUsuario,
} from "./supabase-admin";

/**
 * Casos límite obligatorios de canje de código, ejercitados por la pantalla
 * real (/dashboard/suscripcion, CanjearCodigoForm) — no solo por la función
 * de Postgres. `scripts/canje-codigo-test.ts` (npm run test:canje) ya cubre
 * estos mismos motivos de rechazo, además del canje concurrente por el
 * último cupo, contra `canjear_codigo_invitacion()` directamente — ese es el
 * lugar correcto para la concurrencia (Promise.all real contra la función),
 * repetirla con dos pestañas de Playwright no probaría nada que esa
 * suite no pruebe ya. Este spec cierra el hueco que sí falta: que el
 * Server Action y la pantalla devuelvan el mensaje correcto para cada motivo.
 *
 * Un solo usuario para los cuatro casos (login una vez): el límite de
 * intentos fallidos es 5 por hora por usuario (023_rate_limit...), y aquí
 * como mucho se generan 4 intentos fallidos (incluido el de "ya_canjeado"
 * tras el único canje exitoso).
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-limites-${sufijo}@uva.test`;
const password = "Abcdefg1!x";

// Con guiones en las mismas posiciones que el input real produce
// (formatearCodigoDePrueba) — ver su comentario en supabase-admin.ts.
const sufijoCorto = Date.now().toString(36).toUpperCase();
const codigoInvalido = formatearCodigoDePrueba(`Z${sufijoCorto}`);
const codigoAgotado = formatearCodigoDePrueba(`A${sufijoCorto}`);
const codigoVencido = formatearCodigoDePrueba(`V${sufijoCorto}`);
const codigoValido = formatearCodigoDePrueba(`K${sufijoCorto}`);

let usuarioId: string;
let idsCodigos: string[] = [];

test.beforeAll(async () => {
  const usuario = await crearUsuarioConfirmado(admin, { email, password });
  usuarioId = usuario.id;

  const [agotado, vencido, valido] = await Promise.all([
    crearCodigoInvitacion(admin, { codigo: codigoAgotado, limiteUsos: 1, vecesUsado: 1 }),
    crearCodigoInvitacion(admin, {
      codigo: codigoVencido,
      fechaVencimiento: new Date(Date.now() - 86_400_000).toISOString(),
    }),
    crearCodigoInvitacion(admin, { codigo: codigoValido, limiteUsos: 1 }),
  ]);
  idsCodigos = [agotado.id, vencido.id, valido.id];
});

test.afterAll(async () => {
  await limpiarDatosDeUsuario(admin, usuarioId);
  await Promise.all(idsCodigos.map((id) => borrarCodigoInvitacion(admin, id)));
  await borrarUsuarioPorEmail(admin, email);
});

async function intentarCanjear(page: Page, codigo: string) {
  await page.fill("#codigo-invitacion", "");
  await page.fill("#codigo-invitacion", codigo);
  await page.getByRole("button", { name: "Canjear" }).click();
}

test("código inválido, agotado, vencido y ya canjeado muestran el motivo correcto", async ({ page }) => {
  await test.step("login", async () => {
    await page.goto(`/login?redirect=${encodeURIComponent("/dashboard/suscripcion")}`);
    await page.fill("#auth-email", email);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#login-pass")).toBeVisible();
    await page.fill("#login-pass", password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard\/suscripcion/, { timeout: 30_000 });
  });

  await test.step("código que no existe -> 'Ese código no existe.'", async () => {
    await intentarCanjear(page, codigoInvalido);
    await expect(page.locator("form").getByRole("alert")).toHaveText("Ese código no existe.");
  });

  await test.step("código agotado -> 'Ese código ya alcanzó su límite de usos.'", async () => {
    await intentarCanjear(page, codigoAgotado);
    await expect(page.locator("form").getByRole("alert")).toHaveText("Ese código ya alcanzó su límite de usos.");
  });

  await test.step("código vencido -> 'Ese código venció.'", async () => {
    await intentarCanjear(page, codigoVencido);
    await expect(page.locator("form").getByRole("alert")).toHaveText("Ese código venció.");
  });

  await test.step("código válido se canjea, y reintentarlo -> 'Ya canjeaste este código antes.'", async () => {
    await intentarCanjear(page, codigoValido);
    await expect(page.getByText("Acceso por invitación")).toBeVisible({ timeout: 15_000 });

    // Con acceso vigente, SuscripcionContent ya no renderiza el formulario
    // (solo aparece sin suscripción, o con una que ya venció) — así que para
    // reintentar el MISMO código hay que caducar la suscripción recién
    // creada primero, igual que hace scripts/canje-codigo-test.ts para su
    // propio caso de renovación.
    const { error: errorCaducar } = await admin
      .from("suscripciones")
      .update({ fecha_renovacion: new Date(Date.now() - 86_400_000).toISOString() })
      .eq("id_usuario", usuarioId);
    expect(errorCaducar).toBeNull();

    await page.reload();
    await intentarCanjear(page, codigoValido);
    await expect(page.locator("form").getByRole("alert")).toHaveText("Ya canjeaste este código antes.");
  });
});
