import { expect, test } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  generarEnlaceRecuperacion,
} from "./supabase-admin";

/**
 * Caso límite obligatorio: "Recuperación de contraseña con enlace ya usado o
 * vencido." Un token_hash de recuperación ya consumido, uno alterado y uno
 * realmente vencido llegan al mismo `catch` en /auth/confirm/route.ts
 * (verifyOtp falla -> redirect a /login?error=enlace_invalido): no hay forma
 * de adelantar el reloj del servidor de Supabase Auth para forzar un vencido
 * de verdad en un test, así que "alterado" es el sustituto fiel del mismo
 * camino de código — ambos son, para la app, "verifyOtp devolvió error".
 *
 * BUG-001 (docs/qa/bugs-e2e.md, ya corregido): /login no leía
 * `?error=enlace_invalido` — quien llegaba con un enlace vencido/usado caía
 * en una pantalla de login en blanco, sin ninguna explicación. AuthFlow.tsx
 * ahora siembra `checkError` con MENSAJES_ERROR_QUERY[initialError] al
 * montar, reusando el mismo alert que ya mostraba el paso de correo.
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-recuperar-${sufijo}@uva.test`;
const password = "Abcdefg1!x";
const passwordNueva = "Zabcdefg1!x";

test.beforeAll(async () => {
  await crearUsuarioConfirmado(admin, { email, password });
});

test.afterAll(async () => {
  await borrarUsuarioPorEmail(admin, email);
});

test("enlace de recuperación ya usado no deja volver a entrar con él", async ({ page }) => {
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  const enlace = await generarEnlaceRecuperacion(admin, { email, origin, next: "/actualizar-password" });

  await test.step("primer uso: cambia la contraseña con éxito", async () => {
    await page.goto(enlace);
    await expect(page).toHaveURL("/actualizar-password");
    await page.fill("#nueva-pass", passwordNueva);
    await page.fill("#nueva-pass2", passwordNueva);
    await page.getByRole("button", { name: "Guardar nueva contraseña" }).click();
    // actualizarPassword() cierra la sesión del enlace y manda a /login.
    await expect(page).toHaveURL("/login", { timeout: 15_000 });
  });

  await test.step("segundo uso del MISMO enlace: no entra, y /login explica por qué", async () => {
    await page.goto(enlace);
    await expect(page).toHaveURL("/login?error=enlace_invalido", { timeout: 15_000 });
    // `getByRole("alert")` por sí solo también atraparía el route announcer
    // de Next.js (#__next-route-announcer__, siempre presente y también
    // role="alert"), así que se excluye para no confundirlo con el mensaje
    // real de la app.
    await expect(page.locator('[role="alert"]:not(#__next-route-announcer__)')).toHaveText(
      "Ese enlace ya no es válido o ya venció. Pide uno nuevo.",
    );
  });
});

test("enlace de recuperación con token alterado (mismo camino que uno vencido) no entra", async ({ page }) => {
  await page.goto("/login");
  const origin = new URL(page.url()).origin;
  const enlace = await generarEnlaceRecuperacion(admin, { email, origin, next: "/actualizar-password" });
  const enlaceAlterado = enlace.replace(/token_hash=[^&]+/, "token_hash=alterado-a-mano");

  await page.goto(enlaceAlterado);
  await expect(page).toHaveURL("/login?error=enlace_invalido", { timeout: 15_000 });
});
