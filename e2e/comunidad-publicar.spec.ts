import { test, expect, type Page } from "@playwright/test";
import { adminClient, crearUsuarioConfirmado, borrarUsuarioPorEmail, limpiarDatosDeUsuario } from "./supabase-admin";

/**
 * Publicar y reaccionar en Comunidad solo con teclado (hallazgos de la
 * auditoría: no se podía publicar desde "Todas" y el "me gusta" se anunciaba
 * como un número). Los nombres se comprueban con `getByRole`, que lee el
 * árbol de accesibilidad: lo mismo que oye un lector de pantalla.
 *
 * Crea un usuario con acceso manual y borra sus publicaciones y el usuario
 * al terminar, pase o falle.
 */

const admin = adminClient();
const email = `e2e-comunidad-${Date.now()}@uva.test`;
const password = "Abcdefg1!x";
const titulo = `¿Qué escala uso en A3? (e2e ${Date.now()})`;
let usuarioId: string | undefined;

/** Tab hasta que el foco llegue al elemento: así se prueba el orden real del teclado. */
async function tabularHasta(page: Page, destino: ReturnType<Page["getByRole"]>, maximo = 40) {
  for (let i = 0; i < maximo; i++) {
    await page.keyboard.press("Tab");
    if (await destino.evaluate((el) => el === document.activeElement).catch(() => false)) return;
  }
  throw new Error(`El foco no llegó al elemento en ${maximo} tabulaciones`);
}

test.beforeAll(async () => {
  const user = await crearUsuarioConfirmado(admin, { email, password, nombre: "E2E Comunidad" });
  usuarioId = user.id;
  const { data: plan, error: errPlan } = await admin.from("planes").select("id").limit(1).single();
  if (errPlan || !plan) throw new Error(`No hay plan para otorgar acceso de prueba: ${errPlan?.message}`);
  const { error } = await admin.from("suscripciones").insert({
    id_usuario: user.id,
    id_plan: plan.id,
    fecha_inicio: new Date().toISOString(),
    fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    estado: "ACTIVA",
    proveedor: "manual",
    monto_centavos: 0,
    moneda: "COP",
    acceso_manual: true,
  });
  if (error) throw new Error(`No pude crear la suscripción de prueba: ${error.message}`);
});

test.afterAll(async () => {
  if (usuarioId) {
    // Las reacciones y adjuntos caen en cascada con la publicación.
    await admin.from("comunidad_posts").delete().eq("id_usuario", usuarioId);
    await limpiarDatosDeUsuario(admin, usuarioId);
  }
  await borrarUsuarioPorEmail(admin, email);
});

test("publica desde «Todas» y reacciona solo con teclado", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });

  await page.goto("/dashboard/comunidad");
  const botonNueva = page.getByRole("button", { name: "Nueva publicación" }).first();
  await expect(botonNueva).toBeVisible({ timeout: 60_000 });

  // Abrir con el teclado desde "Todas".
  await page.locator("#contenido").focus();
  await tabularHasta(page, botonNueva);
  await page.keyboard.press("Enter");
  const dialogo = page.getByRole("dialog", { name: "Nueva publicación" });
  await expect(dialogo).toBeVisible();

  // Sin categoría elegida, publicar avisa y lleva el foco a las opciones.
  const publicar = dialogo.getByRole("button", { name: "Publicar", exact: true });
  await publicar.focus();
  await page.keyboard.press("Enter");
  await expect(dialogo.getByRole("alert")).toHaveText("Elige qué quieres compartir.");
  await expect(dialogo.getByRole("radio", { name: "Proyecto" })).toBeFocused();

  // Flechas para moverse entre opciones, como cualquier grupo de radios.
  await page.keyboard.press("ArrowRight");
  await expect(dialogo.getByRole("radio", { name: "Pregunta" })).toBeChecked();

  await tabularHasta(page, dialogo.getByRole("textbox", { name: "Tu pregunta" }));
  await page.keyboard.type(titulo);
  await tabularHasta(page, dialogo.getByRole("textbox", { name: "Detalles" }));
  await page.keyboard.type("Es una casa de 120 m² y no sé si 1:50 o 1:75 se lee mejor.");
  await tabularHasta(page, dialogo.getByRole("button", { name: "Publicar pregunta" }));
  await page.keyboard.press("Enter");

  await expect(dialogo).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText("Publicaste en Preguntas generales")).toBeVisible();
  const tarjeta = page.getByRole("article").filter({ hasText: titulo });
  await expect(tarjeta).toBeVisible({ timeout: 30_000 });

  // "Me gusta": nombre que dice qué hace, estado en aria-pressed y el número aparte.
  const meGusta = tarjeta.getByRole("button", { name: "Me gusta", exact: true });
  await expect(meGusta).toHaveAttribute("aria-pressed", "false");
  await meGusta.focus();
  await page.keyboard.press("Space");
  const quitar = tarjeta.getByRole("button", { name: "Quitar me gusta" });
  await expect(quitar).toHaveAttribute("aria-pressed", "true");
  await expect(quitar).toBeFocused();
  await expect(tarjeta.getByText("1", { exact: true })).toBeVisible();

  // Tras guardar en el servidor sigue marcado.
  await page.reload();
  await expect(
    page.getByRole("article").filter({ hasText: titulo }).getByRole("button", { name: "Quitar me gusta" }),
  ).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
});
