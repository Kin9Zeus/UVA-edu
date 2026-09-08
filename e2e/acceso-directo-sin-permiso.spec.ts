import { expect, test } from "@playwright/test";
import { adminClient, borrarUsuarioPorEmail, crearUsuarioConfirmado, CURSO_FIXTURE } from "./supabase-admin";

/**
 * Caso límite obligatorio: "Usuario sin acceso intentando entrar por URL
 * directa a una lección." Se prueban las dos variantes que
 * getLeccionPlayer()/LeccionPlayerPage (src/app/(public)/cursos/[id]/[leccionId]/page.tsx)
 * distinguen — sin sesión y con sesión pero sin suscripción vigente — porque
 * cada una redirige a un sitio distinto.
 *
 * Usa la segunda lección del curso fixture (no la primera): la primera es
 * vista previa pública a propósito ("esIntroduccion", lib/leccion.ts) y por
 * diseño SÍ debe abrir sin acceso — probar el candado contra ella daría un
 * falso positivo.
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-sinacceso-${sufijo}@uva.test`;
const password = "Abcdefg1!x";
const leccionGateada = CURSO_FIXTURE.lecciones[1];

test.beforeAll(async () => {
  await crearUsuarioConfirmado(admin, { email, password });
});

test.afterAll(async () => {
  await borrarUsuarioPorEmail(admin, email);
});

test("sin sesión: URL directa a una lección redirige a /login con el destino guardado", async ({ page }) => {
  await page.goto(`/cursos/${CURSO_FIXTURE.id}/${leccionGateada.id}`);
  // LeccionPlayerPage arma este redirect sin encodeURIComponent (el path no
  // trae caracteres que lo necesiten): mismo formato exacto acá.
  await expect(page).toHaveURL(`/login?redirect=/cursos/${CURSO_FIXTURE.id}/${leccionGateada.id}`);
});

test("con sesión pero sin suscripción: URL directa a una lección redirige a la ficha del curso (candado)", async ({
  page,
}) => {
  await page.goto(`/login?redirect=/cursos/${CURSO_FIXTURE.id}/${leccionGateada.id}`);
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible();
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // LeccionPlayerPage: sin acceso vigente, con el curso todavía visible, se
  // devuelve a su ficha en vez de mostrar la lección o un 404.
  await expect(page).toHaveURL(`/cursos/${CURSO_FIXTURE.id}`, { timeout: 30_000 });
});

/**
 * P2-1 (AUDIT-2026-09-08): el muro de rol del panel.
 *
 * Se navega a /admin DESPUÉS de iniciar sesión, en vez de usar
 * `/login?redirect=/admin`, para no mezclar dos cosas en una sola prueba:
 * lo que se comprueba acá es la puerta de rol, no si el login respeta el
 * parámetro `redirect`.
 *
 * El guardián que bloquea un merge es `src/lib/admin/muro-admin.test.ts`
 * (estructural, corre en el job `checks`). Esta es la prueba de
 * comportamiento —la que de verdad demuestra que el estudiante aterriza en
 * /acceso-denegado— pero el job `e2e` está fuera de CI desde el
 * 2026-09-08, así que hoy solo corre a mano con `npm run test:e2e`.
 */
test("con sesión de estudiante: URL directa a /admin redirige a /acceso-denegado", async ({
  page,
}) => {
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible();
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

  await page.goto("/admin");
  await expect(page).toHaveURL("/acceso-denegado", { timeout: 30_000 });
});
