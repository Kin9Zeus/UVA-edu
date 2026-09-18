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
 * Capa 2 — manipulación del canje de código como lo haría una persona real:
 * pegar mal, impacientarse, quedarse sin red, dejar la sesión abierta horas,
 * usar dos pestañas o insistir con códigos al azar.
 *
 * Complementa, no repite, a canje-casos-limite.spec.ts (un motivo de rechazo
 * por caso) y a scripts/canje-codigo-test.ts (concurrencia contra la función
 * de Postgres). Cada test usa su propio usuario: el rate limit y la
 * suscripción son por usuario y se contaminarían entre casos.
 *
 * Corre contra el proyecto real de Supabase (no hay staging); todo lo que se
 * crea se borra en afterAll.
 */

const admin = adminClient();
const sufijo = Date.now();
const password = "Abcdefg1!x";
const RUTA = "/dashboard/suscripcion";

const usuarios: { email: string; id: string }[] = [];
const codigos: string[] = [];

async function nuevoUsuario(etiqueta: string) {
  const email = `e2e-capa2-canje-${etiqueta}-${sufijo}@uva.test`;
  const user = await crearUsuarioConfirmado(admin, { email, password });
  usuarios.push({ email, id: user.id });
  return { email, id: user.id };
}

let contadorCodigos = 0;
async function nuevoCodigo(params: { limiteUsos?: number } = {}) {
  contadorCodigos += 1;
  // 11 caracteres como un código real (UVA-XXXX-XXXX): con uno más corto, el
  // recorte del campo (maxLength) no se nota y el test daría falsos positivos.
  const codigo = formatearCodigoDePrueba(`UV${contadorCodigos}${sufijo.toString(36).toUpperCase()}`.slice(0, 11));
  const fila = await crearCodigoInvitacion(admin, { codigo, limiteUsos: params.limiteUsos ?? 1 });
  codigos.push(fila.id);
  return { codigo, id: fila.id as string };
}

async function vecesUsado(codigoId: string) {
  const { data } = await admin.from("codigos_invitacion").select("veces_usado").eq("id", codigoId).single();
  return data?.veces_usado as number;
}

async function suscripcionesDe(usuarioId: string) {
  const { data } = await admin.from("suscripciones").select("id, id_codigo_invitacion").eq("id_usuario", usuarioId);
  return data ?? [];
}

async function iniciarSesion(page: Page, email: string) {
  await page.goto(`/login?redirect=${encodeURIComponent(RUTA)}`);
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(RUTA), { timeout: 60_000 });
  await expect(page.locator("#codigo-invitacion")).toBeVisible();
}

/** Excepciones de JS sin capturar: en ningún caso de manipulación deben aparecer. */
function vigilarExcepciones(page: Page) {
  const excepciones: string[] = [];
  page.on("pageerror", (err) => excepciones.push(err.message));
  return excepciones;
}

const esServerAction = (headers: Record<string, string>) => "next-action" in headers;

test.afterAll(async () => {
  for (const u of usuarios) {
    await limpiarDatosDeUsuario(admin, u.id);
    await borrarUsuarioPorEmail(admin, u.email);
  }
  for (const id of codigos) await borrarCodigoInvitacion(admin, id);
});

test("pegar el código en minúsculas, con espacios o sin guiones igual lo canjea", async ({ browser }) => {
  // Tres usuarios porque cada canje exitoso deja al usuario con acceso y el
  // formulario desaparece.
  const variantes = [
    (c: string) => `  ${c.toLowerCase()}  `,
    (c: string) => c.replace(/-/g, ""),
    (c: string) => c.replace(/-/g, " "),
  ];

  for (const [i, variante] of variantes.entries()) {
    const { email, id } = await nuevoUsuario(`pegado${i}`);
    const { codigo } = await nuevoCodigo();
    const context = await browser.newContext();
    const page = await context.newPage();
    const excepciones = vigilarExcepciones(page);
    await iniciarSesion(page, email);

    const escrito = variante(codigo);
    await page.locator("#codigo-invitacion").fill(escrito);
    await page.getByRole("button", { name: "Canjear" }).click();

    await expect(page.getByText("Acceso por invitación"), `variante "${escrito}"`).toBeVisible({ timeout: 20_000 });
    expect(await suscripcionesDe(id)).toHaveLength(1);
    expect(excepciones).toEqual([]);
    await context.close();
  }
});

test("pegar el código junto con el texto del correo ('Tu código: UVA-...')", async ({ page }) => {
  // Así llega en un correo o un WhatsApp, y es lo que la gente copia entero.
  const { email, id } = await nuevoUsuario("conetiqueta");
  const { codigo } = await nuevoCodigo();
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);

  await page.locator("#codigo-invitacion").fill(`Tu código: ${codigo}`);
  const visible = await page.locator("#codigo-invitacion").inputValue();
  await page.getByRole("button", { name: "Canjear" }).click();

  // Lo mínimo aceptable: o se canjea, o se muestra un error comprensible.
  // Lo que NO puede pasar es que el campo muestre algo que no se parece al
  // código pegado y el usuario no entienda por qué "no existe".
  const exito = page.getByText("Acceso por invitación");
  const alerta = page.locator("form").getByRole("alert");
  await expect(exito.or(alerta)).toBeVisible({ timeout: 20_000 });
  const canjeo = (await suscripcionesDe(id)).length === 1;
  expect(
    canjeo,
    `el campo quedó como "${visible}" (código real ${codigo}) y el canje ${canjeo ? "funcionó" : `falló con "${await alerta.textContent()}"`}`,
  ).toBe(true);
  expect(excepciones).toEqual([]);
});

test("doble clic y Enter repetido no consumen dos usos ni muestran error tras el éxito", async ({ page }) => {
  const { email, id } = await nuevoUsuario("dobleclic");
  // Dos usos disponibles: si el doble envío llegara al servidor, se vería
  // en veces_usado = 2 en vez de chocar contra un límite de 1.
  const { codigo, id: codigoId } = await nuevoCodigo({ limiteUsos: 2 });
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);

  let envios = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && esServerAction(req.headers())) envios += 1;
  });

  const input = page.locator("#codigo-invitacion");
  await input.fill(codigo);
  await page.getByRole("button", { name: "Canjear" }).dblclick();
  await input.press("Enter").catch(() => {});
  await input.press("Enter").catch(() => {});

  await expect(page.getByText("Acceso por invitación")).toBeVisible({ timeout: 20_000 });
  await page.waitForTimeout(2_000);

  expect(await vecesUsado(codigoId), `se hicieron ${envios} envíos del Server Action`).toBe(1);
  expect(await suscripcionesDe(id)).toHaveLength(1);
  // Solo el del formulario: Next monta su propio anunciador de rutas con role="alert".
  await expect(page.locator("form").getByRole("alert")).toHaveCount(0);
  expect(excepciones).toEqual([]);
});

test("se cae la red justo al canjear: el formulario no se queda congelado", async ({ page }) => {
  const { email } = await nuevoUsuario("sinred");
  const { codigo, id: codigoId } = await nuevoCodigo();
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);

  await page.route(`**${RUTA}`, (route) =>
    route.request().method() === "POST" && esServerAction(route.request().headers())
      ? route.abort("internetdisconnected")
      : route.continue(),
  );

  await page.locator("#codigo-invitacion").fill(codigo);
  await page.getByRole("button", { name: "Canjear" }).click();

  // Esperado: un mensaje que diga que falló y el botón de nuevo disponible
  // para reintentar. No: "Canjeando…" para siempre.
  await expect(page.locator("form").getByRole("alert")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: "Canjear" })).toBeEnabled();
  expect(await vecesUsado(codigoId)).toBe(0);

  // Vuelve la red: el mismo código se canjea sin recargar.
  await page.unroute(`**${RUTA}`);
  await page.getByRole("button", { name: "Canjear" }).click();
  await expect(page.getByText("Acceso por invitación")).toBeVisible({ timeout: 20_000 });
  expect(excepciones).toEqual([]);
});

test("sesión cerrada en otra pestaña: canjear explica que hay que volver a entrar", async ({ browser }) => {
  const { email, id } = await nuevoUsuario("sesion");
  const { codigo, id: codigoId } = await nuevoCodigo();
  const context = await browser.newContext();
  const page = await context.newPage();
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);

  // Lo mismo que cerrar sesión en otra pestaña o que caduque la cookie:
  // la página sigue abierta, pero ya no hay sesión detrás.
  await context.clearCookies();

  await page.locator("#codigo-invitacion").fill(codigo);
  await page.getByRole("button", { name: "Canjear" }).click();

  // Vale cualquiera de las dos: mandarlo a /login, o decirle en el
  // formulario que la sesión expiró. Lo que no vale es un error genérico.
  const alerta = page.locator("form").getByRole("alert");
  await expect(alerta.or(page.locator("#auth-email"))).toBeVisible({ timeout: 15_000 });
  if (await alerta.isVisible()) await expect(alerta).toContainText(/sesión/i);
  expect(await vecesUsado(codigoId)).toBe(0);
  expect(await suscripcionesDe(id)).toHaveLength(0);
  expect(excepciones).toEqual([]);
  await context.close();
});

test("dos pestañas: canjear un código en cada una deja una sola suscripción", async ({ browser }) => {
  const { email, id } = await nuevoUsuario("dospestanas");
  const primero = await nuevoCodigo();
  const segundo = await nuevoCodigo();
  const context = await browser.newContext();
  const pestana1 = await context.newPage();
  const excepciones = vigilarExcepciones(pestana1);
  await iniciarSesion(pestana1, email);
  const pestana2 = await context.newPage();
  excepciones.push(...vigilarExcepciones(pestana2));
  await pestana2.goto(RUTA);
  await expect(pestana2.locator("#codigo-invitacion")).toBeVisible();

  await pestana1.locator("#codigo-invitacion").fill(primero.codigo);
  await pestana1.getByRole("button", { name: "Canjear" }).click();
  await expect(pestana1.getByText("Acceso por invitación")).toBeVisible({ timeout: 20_000 });

  // La segunda pestaña todavía muestra el formulario: no sabe que ya hay acceso.
  await pestana2.locator("#codigo-invitacion").fill(segundo.codigo);
  await pestana2.getByRole("button", { name: "Canjear" }).click();
  await expect(pestana2.locator("form").getByRole("alert")).toContainText("Ya tienes una suscripción activa", {
    timeout: 20_000,
  });

  expect(await suscripcionesDe(id)).toHaveLength(1);
  expect(await vecesUsado(segundo.id), "el segundo código no debe gastarse").toBe(0);
  expect(excepciones).toEqual([]);
  await context.close();
});

test("probar códigos al azar bloquea el formulario, y recargar no se salta el bloqueo", async ({ page }) => {
  test.setTimeout(3 * 60_000);
  const { email, id } = await nuevoUsuario("fuerzabruta");
  const valido = await nuevoCodigo();
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);

  const input = page.locator("#codigo-invitacion");
  const boton = page.locator("form button[type=submit]");
  const alerta = page.locator("form").getByRole("alert");

  let bloqueado = false;
  for (let intento = 1; intento <= 8 && !bloqueado; intento += 1) {
    await input.fill(`ZZZ${intento}${sufijo.toString(36)}`.toUpperCase());
    await boton.click();
    await expect(alerta).toBeVisible({ timeout: 15_000 });
    await expect(boton).not.toHaveText("Canjeando…", { timeout: 15_000 });
    bloqueado = /Demasiados intentos/.test((await alerta.textContent()) ?? "");
  }
  expect(bloqueado, "tras 8 códigos falsos seguidos el formulario nunca se bloqueó").toBe(true);
  await expect(boton).toBeDisabled();
  await expect(input).toBeDisabled();

  // Recargar limpia el estado de React, pero el límite vive en la base.
  await page.reload();
  await input.fill(valido.codigo);
  await boton.click();
  await expect(alerta).toContainText("Demasiados intentos", { timeout: 15_000 });
  expect(await suscripcionesDe(id)).toHaveLength(0);
  expect(excepciones).toEqual([]);
});
