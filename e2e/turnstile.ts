import type { Page } from "@playwright/test";

/**
 * Fase 4 (Turnstile): antes de enviar un formulario con el recuadro de
 * Cloudflare, espera a que deje su token en el formulario. Una persona tarda
 * más en escribir que el recuadro en marcarse (1-2 s); el robot de pruebas
 * no: sin esta espera, con el CAPTCHA de staging encendido, Supabase rechaza
 * el envío sin token y la prueba se queda en /login.
 *
 * Sin recuadro en la página (sin NEXT_PUBLIC_TURNSTILE_SITE_KEY), no espera.
 */
export async function esperarTurnstile(page: Page, timeout = 30_000): Promise<void> {
  if ((await page.locator("[data-verificacion-turnstile]").count()) === 0) return;
  await page.waitForFunction(
    () => {
      const campo = document.querySelector<HTMLInputElement>('input[name="cf-turnstile-response"]');
      return Boolean(campo && campo.value.length > 0);
    },
    null,
    { timeout },
  );
}
