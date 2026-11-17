import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Consentimiento de analítica (components/analitica/Analitica.tsx).
 *
 * Lo que no se puede romper: ANTES de «Aceptar» no sale ninguna petición a
 * Google ni a Microsoft, y rechazar no deja cookies de analítica.
 *
 * Necesita la app con analítica encendida, con ID falsos:
 *   NEXT_PUBLIC_GA_ID=G-E2EPRUEBA1 NEXT_PUBLIC_CLARITY_ID=e2eprueba1 npm run test:e2e -- e2e/analitica-consentimiento.spec.ts
 * Sin esas variables se salta (la analítica está apagada y no hay aviso).
 *
 * Las peticiones a Google y Clarity se interceptan y se responden vacías: la
 * prueba nunca manda datos a un tercero.
 */

const ENCENDIDA = Boolean(process.env.NEXT_PUBLIC_GA_ID || process.env.NEXT_PUBLIC_CLARITY_ID);
const CON_CLARITY = Boolean(process.env.NEXT_PUBLIC_CLARITY_ID);
const TERCEROS = /googletagmanager\.com|google-analytics\.com|analytics\.google\.com|clarity\.ms|bing\.com/;
const AXE_PATH = join(process.cwd(), "node_modules/axe-core/axe.min.js");

test.skip(!ENCENDIDA, "Analítica apagada: se corre con NEXT_PUBLIC_GA_ID o NEXT_PUBLIC_CLARITY_ID (ID falsos).");

/** Intercepta a los terceros y devuelve la lista viva de hosts pedidos. */
async function vigilarTerceros(context: BrowserContext): Promise<string[]> {
  const hosts: string[] = [];
  await context.route(TERCEROS, (ruta) => {
    hosts.push(new URL(ruta.request().url()).host);
    return ruta.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });
  return hosts;
}

const aviso = (page: Page) => page.getByRole("region", { name: "Cookies de análisis" });

async function cookiesDeAnalitica(context: BrowserContext) {
  return (await context.cookies()).map((c) => c.name).filter((n) => /^(_ga|_gid|_clck|_clsk)/.test(n));
}

test("sin decidir: sale el aviso y no se pide nada a Google ni a Microsoft", async ({ context, page }) => {
  const hosts = await vigilarTerceros(context);
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(aviso(page)).toBeVisible();
  // Los dos botones, con el mismo peso: rechazar no cuesta más que aceptar.
  const rechazar = page.getByRole("button", { name: "Rechazar" });
  const aceptar = page.getByRole("button", { name: "Aceptar" });
  expect(await rechazar.getAttribute("class")).toBe(await aceptar.getAttribute("class"));
  expect(hosts).toEqual([]);
  expect(await cookiesDeAnalitica(context)).toEqual([]);
});

test("rechazar: el aviso se va, no vuelve y nada se carga", async ({ context, page }) => {
  const hosts = await vigilarTerceros(context);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Rechazar" }).click();
  await expect(aviso(page)).toBeHidden();
  await page.reload({ waitUntil: "networkidle" });
  await expect(aviso(page)).toBeHidden();
  expect(hosts).toEqual([]);
});

test("aceptar carga la analítica; retirar el consentimiento la apaga y borra sus cookies", async ({ context, page }) => {
  const hosts = await vigilarTerceros(context);
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Aceptar" }).click();
  await expect(aviso(page)).toBeHidden();
  await expect.poll(() => hosts.length).toBeGreaterThan(0);

  // Simula la cookie que deja GA4 (la respuesta interceptada no la escribe).
  await context.addCookies([{ name: "_ga", value: "GA1.1.1.1", url: new URL(page.url()).origin }]);

  await page.getByRole("button", { name: "Configurar cookies" }).click();
  await expect(aviso(page)).toBeVisible();
  await page.getByRole("button", { name: "Rechazar" }).click();
  await page.waitForLoadState("networkidle");
  expect(await cookiesDeAnalitica(context)).toEqual([]);

  hosts.length = 0;
  await page.reload({ waitUntil: "networkidle" });
  expect(hosts).toEqual([]);
});

test("Clarity no carga en páginas con datos personales aunque haya consentimiento", async ({ context, page }) => {
  test.skip(!CON_CLARITY, "Sin NEXT_PUBLIC_CLARITY_ID");
  const hosts = await vigilarTerceros(context);
  await context.addInitScript(() => {
    localStorage.setItem(
      "uva-consentimiento-analitica",
      JSON.stringify({ decision: "aceptada", version: 1, fecha: new Date().toISOString() }),
    );
  });
  // Muestra el nombre del estudiante: fuera de clarityPermitida().
  await page.goto("/verificar-certificado/UVA-E2E-0000", { waitUntil: "networkidle" });
  expect(hosts.filter((h) => h.includes("clarity"))).toEqual([]);
});

test("el aviso se usa con teclado y pasa axe en los dos temas", async ({ page }) => {
  for (const tema of ["oscuro", "claro"]) {
    await page.addInitScript((t) => localStorage.setItem("uva-tema", t), tema);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(aviso(page)).toBeVisible();

    await page.addScriptTag({ path: AXE_PATH });
    const violaciones = await page.evaluate(async () => {
      // @ts-expect-error axe lo inyecta addScriptTag
      const r = await window.axe.run("section[aria-labelledby]", {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      });
      return (r.violations as Array<{ id: string }>).map((v) => v.id);
    });
    expect(violaciones, `axe en tema ${tema}`).toEqual([]);

    // Con Tab se llega a «Rechazar», con foco visible, y Enter decide.
    const rechazar = page.getByRole("button", { name: "Rechazar" });
    for (let i = 0; i < 80 && !(await rechazar.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
    await expect(rechazar).toBeFocused();
    const contorno = await rechazar.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(contorno).not.toBe("none");
    await page.keyboard.press("Enter");
    await expect(aviso(page)).toBeHidden();
    await page.evaluate(() => localStorage.clear());
  }
});
