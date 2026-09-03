import { expect, test } from "@playwright/test";
import { adminClient, borrarUsuarioPorEmail, crearUsuarioConfirmado } from "./supabase-admin";

/**
 * Caso límite obligatorio: "Registro con un correo que ya existe."
 *
 * AuthFlow.tsx no tiene un mensaje de error dedicado para esto: el paso de
 * correo (checkEmail -> check_email_provider) ya decide que la cuenta existe
 * y salta directo al paso de login (step "login", #login-pass) en vez de
 * mostrar el formulario de registro — es works-as-designed, no un bug, y por
 * eso lo que hay que probar es justo que NUNCA se llega al formulario de
 * registro para un correo que ya tiene cuenta con contraseña.
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-existente-${sufijo}@uva.test`;
const password = "Abcdefg1!x";

test.beforeAll(async () => {
  await crearUsuarioConfirmado(admin, { email, password, nombre: "Ya Registrado E2E" });
});

test.afterAll(async () => {
  await borrarUsuarioPorEmail(admin, email);
});

test("escribir un correo que ya tiene cuenta manda a login, nunca al formulario de registro", async ({ page }) => {
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();

  await expect(page.locator("#login-pass")).toBeVisible();
  await expect(page.locator("#reg-nombre")).toHaveCount(0);
});
