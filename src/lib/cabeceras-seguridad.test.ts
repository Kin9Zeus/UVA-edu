import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

/**
 * Las cabeceras de seguridad HTTP y la supresión de `X-Powered-By`.
 *
 * Por qué existe esta prueba
 * --------------------------
 * Las cinco cabeceras de `next.config.ts` tardaron TRES auditorías
 * consecutivas en aparecer (P2-2, señalado el 24-ago, el 26-ago y el 4-sep
 * antes de implementarse). Hasta hoy nada impedía que alguien borrara el
 * bloque `headers()` en un merge y volviera al punto de partida: no lo
 * detecta el compilador, ni el lint, ni ninguna prueba. Un control de
 * seguridad que costó ese esfuerzo no puede depender de que nadie toque un
 * objeto de configuración por accidente.
 *
 * Se importa el config REAL en vez de leerlo como texto —a diferencia de
 * `site-url.test.ts` o `muro-admin.test.ts`, donde lo que se busca es un
 * patrón en el código— porque acá lo que importa es el objeto que Next
 * termina recibiendo. `withSentryConfig()` lo envuelve antes de exportarlo,
 * así que probar el texto del archivo no demostraría que las cabeceras
 * sobreviven esa envoltura. Este import sí.
 *
 * Lo que esta prueba NO cubre: que Railway o cualquier proxy delante no las
 * reescriba. Eso solo se ve con una petición real al dominio
 * (`curl -sI https://uva-edu-production.up.railway.app/`).
 */

const ESPERADAS: Record<string, string | RegExp> = {
  // HSTS de un año con subdominios. Sin `preload` a propósito: ese paso es
  // prácticamente irreversible (ver el comentario en next.config.ts).
  "Strict-Transport-Security": /max-age=31536000/,
  // La app sirve archivos subidos por usuarios desde Storage.
  "X-Content-Type-Options": "nosniff",
  // Protege tokens en la URL, p. ej. /verificar-certificado/[codigo].
  "Referrer-Policy": "strict-origin-when-cross-origin",
  // Clickjacking sobre un usuario ya logueado. DENY, no SAMEORIGIN: nada en
  // src/ enmarca la app.
  "X-Frame-Options": "DENY",
  // Apaga APIs del navegador que el producto no usa.
  "Permissions-Policy": /camera=\(\)/,
};

describe("cabeceras de seguridad HTTP", () => {
  it("no anuncia el framework en X-Powered-By (P3-2)", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });

  it("define una regla de cabeceras que cubre todas las rutas", async () => {
    const reglas = await nextConfig.headers?.();

    expect(reglas).toBeDefined();
    expect(reglas?.some((regla) => regla.source === "/:path*")).toBe(true);
  });

  it.each(Object.entries(ESPERADAS))("manda %s", async (nombre, esperado) => {
    const reglas = (await nextConfig.headers?.()) ?? [];
    const todas = reglas.flatMap((regla) => regla.headers);
    const cabecera = todas.find((h) => h.key.toLowerCase() === nombre.toLowerCase());

    expect(cabecera, `falta la cabecera ${nombre}`).toBeDefined();
    if (typeof esperado === "string") {
      expect(cabecera?.value).toBe(esperado);
    } else {
      expect(cabecera?.value).toMatch(esperado);
    }
  });

  /**
   * La CSP sigue fuera a propósito (P2-2, AUDIT-2026-09-08): necesita un
   * nonce por request, así que su sitio es `src/proxy.ts`, no una lista
   * estática acá. Esta prueba deja constancia de que la ausencia es una
   * decisión y no un olvido — y falla el día que alguien la añada aquí, que
   * es justo cuando conviene releer por qué se decidió lo contrario.
   */
  it("la CSP NO se define en next.config.ts (va con nonce desde el proxy)", async () => {
    const reglas = (await nextConfig.headers?.()) ?? [];
    const claves = reglas.flatMap((regla) => regla.headers).map((h) => h.key.toLowerCase());

    expect(claves).not.toContain("content-security-policy");
  });
});
