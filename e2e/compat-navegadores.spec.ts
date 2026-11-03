import { expect, test } from "@playwright/test";

/**
 * Matriz de compatibilidad (docs/qa/compatibilidad.md). Corre en cada
 * navegador y dispositivo de playwright.compat.config.ts, en tema claro y
 * oscuro, sobre las pantallas públicas del recorrido (no necesitan sesión).
 * Verifica lo que un motor puede medir: sin scroll horizontal, sin errores de
 * consola, zonas seguras del iPhone activas y el botón de WhatsApp sin tapar
 * nada.
 */

const PANTALLAS = ["/", "/login", "/catalogo", "/soporte"];

for (const tema of ["oscuro", "claro"] as const) {
  for (const ruta of PANTALLAS) {
    test(`${ruta} en tema ${tema}`, async ({ page }, info) => {
      await page.addInitScript((t) => localStorage.setItem("uva-tema", t), tema);
      const errores: string[] = [];
      page.on("pageerror", (e) => errores.push(e.message));
      page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

      await page.goto(ruta, { waitUntil: "networkidle" });
      await expect(page.locator("html")).toHaveClass(tema === "oscuro" ? /dark/ : /^((?!dark).)*$/);

      // Sin scroll horizontal.
      const sobra = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(sobra, "scroll horizontal").toBeLessThanOrEqual(0);

      // Sin `viewport-fit=cover` env(safe-area-inset-*) vale 0 en iPhone.
      const meta = await page.locator('meta[name="viewport"]').getAttribute("content");
      expect(meta, "meta viewport").toContain("viewport-fit=cover");

      // Errores propios de la app (CSP, hidratación, JS). Se ignoran los de
      // recursos externos de terceros.
      expect(errores.filter((e) => !/favicon|sentry|mux|net::/i.test(e)), "consola").toEqual([]);

      await page.screenshot({
        path: `docs/qa/compatibilidad/capturas/${info.project.name}${ruta === "/" ? "-inicio" : ruta.replace(/\//g, "-")}-${tema}.png`,
        fullPage: false,
      });
    });
  }
}

test("el botón de WhatsApp no tapa ningún enlace ni botón de la portada", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const wa = page.locator('a.fixed[aria-label*="WhatsApp"]');
  await expect(wa).toBeVisible();
  const caja = (await wa.boundingBox())!;
  const vp = page.viewportSize()!;

  // Dentro de la zona visible y a la vista en cada posición de scroll.
  expect(caja.x + caja.width).toBeLessThanOrEqual(vp.width);
  expect(caja.y + caja.height).toBeLessThanOrEqual(vp.height);

  const alto = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < alto; y += Math.max(200, vp.height - 100)) {
    await page.evaluate((v) => window.scrollTo(0, v), y);
    const tapados = await page.evaluate(
      ([x, yy, w, h]) => {
        const wa = document.querySelector('a.fixed[aria-label*="WhatsApp"]');
        return [...document.querySelectorAll("a[href], button, input, select, textarea")]
          .filter((el) => el !== wa && !wa?.contains(el))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            const visible = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight;
            const cx = (r.left + r.right) / 2;
            const cy = (r.top + r.bottom) / 2;
            // "Tapa" = cubre el centro del elemento: un roce en el borde
            // (p. ej. el relleno del CTA) se mide aparte, ver compatibilidad.md.
            return visible && cx > x && cx < x + w && cy > yy && cy < yy + h;
          })
          .map((el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 40));
      },
      [caja.x, caja.y, caja.width, caja.height],
    );
    expect(tapados, `scroll ${y}: el botón tapa`).toEqual([]);
  }
});
