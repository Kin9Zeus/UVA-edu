import { expect, test } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  generarEnlaceConfirmacion,
} from "./supabase-admin";

// P2-7 Fase B (AUDIT-2026-08-24.md), recorrido 1 de 3: registro →
// verificación → login. La confirmación de correo se resuelve con
// admin.auth.admin.generateLink() en vez de una bandeja real (ver
// e2e/supabase-admin.ts), pero todo lo demás — el formulario, el
// intercambio del enlace en /auth/confirm, el login — corre contra la
// app real.

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-registro-${sufijo}@uva.test`;
const password = "Abcdefg1!x"; // cumple las 4 reglas de src/lib/password.ts
const nombre = "Estudiante E2E";

test.afterEach(async () => {
  await borrarUsuarioPorEmail(admin, email);
});

test("registro -> verificación de correo -> login llega al dashboard", async ({ page }) => {
  await test.step("paso de correo en /login decide que la cuenta no existe", async () => {
    await page.goto("/login");
    await page.fill("#auth-email", email);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#reg-nombre")).toBeVisible();
  });

  await test.step("llena el formulario de registro y lo envía", async () => {
    await page.fill("#reg-nombre", nombre);
    await page.fill("#reg-pass", password);
    await page.fill("#reg-pass2", password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(
      page.getByText(`Te enviamos un correo de confirmación a ${email}`),
    ).toBeVisible();
  });

  await test.step("confirma el correo visitando el enlace real (sin bandeja)", async () => {
    const origin = new URL(page.url()).origin;
    const enlace = await generarEnlaceConfirmacion(admin, {
      email,
      password,
      origin,
      // Mismo "next" que registro.ts pone en emailRedirectTo: signout=1
      // para que /auth/confirm cierre la sesión del enlace antes de
      // redirigir, y el usuario tenga que volver a escribir su contraseña.
      next: `/login?signout=1&email=${encodeURIComponent(email)}`,
    });
    await page.goto(enlace);
    // /auth/confirm cierra la sesión que deja el enlace (signout=1) y
    // redirige a /login?email=... — AuthFlow salta directo al paso de
    // contraseña porque el correo ya existe y usa provider "password".
    await expect(page).toHaveURL(/\/login\?email=/);
    await expect(page.locator("#login-pass")).toBeVisible();
  });

  await test.step("inicia sesión con la contraseña recién creada", async () => {
    await page.fill("#login-pass", password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });
});
