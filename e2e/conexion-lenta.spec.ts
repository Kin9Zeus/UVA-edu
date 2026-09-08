import { expect, test } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  CURSO_FIXTURE,
  limpiarDatosDeUsuario,
  verificarCursoFixture,
} from "./supabase-admin";

/**
 * Requisito de calidad obligatorio: "Probar... con una conexión lenta
 * simulada." No mide performance (eso ya lo hace
 * scripts/audit/lighthouse-audit.ts): el objetivo es confirmar que el
 * recorrido de un estudiante con sesión iniciada —catálogo, ficha del
 * curso, arranque del reproductor— no se rompe bajo latencia alta y poco
 * ancho de banda reales, solo tarda más.
 *
 * Se usa `Network.emulateNetworkConditions` vía CDP (solo Chromium, que es
 * el único proyecto configurado en playwright.config.ts) en vez de
 * `page.route()` con retrasos a mano: CDP throttlea la conexión real del
 * navegador (igual que "Slow 3G" en las DevTools), afectando también los
 * segmentos del video de Mux — `page.route()` solo podría retrasar las
 * peticiones que Playwright decide interceptar, no todo el tráfico.
 *
 * Usa la lección introductoria del curso fixture (pública, sin canje) para
 * no meter el tiempo de un canje de código dentro de una prueba que ya de
 * por sí es lenta a propósito.
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-lenta-${sufijo}@uva.test`;
const password = "Abcdefg1!x";
const [leccion1] = CURSO_FIXTURE.lecciones;

// Orden de magnitud de "Slow 3G" en Chrome DevTools: ~400 Kbps de bajada y
// subida, 400 ms de latencia — no los valores exactos, que cambian de
// versión en versión, pero sí el mismo tipo de degradación real.
const CONEXION_LENTA = {
  offline: false,
  downloadThroughput: (400 * 1024) / 8,
  uploadThroughput: (400 * 1024) / 8,
  latency: 400,
};

let usuarioId: string;
// CursoCard.tsx arma el href del catálogo con el slug del curso, no con su
// UUID (cambio de rutas a slug con fallback a UUID) — se resuelve acá en vez
// de hardcodearlo en CURSO_FIXTURE para no duplicar la fuente de verdad.
let cursoSlug: string;

test.beforeAll(async () => {
  await verificarCursoFixture(admin);
  const usuario = await crearUsuarioConfirmado(admin, { email, password });
  usuarioId = usuario.id;

  const { data: curso, error } = await admin
    .from("cursos")
    .select("slug")
    .eq("id", CURSO_FIXTURE.id)
    .single();
  if (error || !curso) throw new Error(`No pude leer el slug de CURSO_FIXTURE: ${error?.message}`);
  cursoSlug = curso.slug;
});

test.afterAll(async () => {
  await limpiarDatosDeUsuario(admin, usuarioId);
  await borrarUsuarioPorEmail(admin, email);
});

test("login, catálogo, ficha del curso y arranque del video sobreviven a una conexión lenta simulada", async ({
  page,
}) => {
  // Con la conexión throttleada cada paso tarda varias veces más que en un
  // spec normal: test.slow() triplica el timeout por defecto del spec.
  test.slow();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", CONEXION_LENTA);

  await test.step("login bajo conexión lenta", async () => {
    await page.goto("/login");
    await page.fill("#auth-email", email);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
    await page.fill("#login-pass", password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 60_000 });
  });

  await test.step("el catálogo carga y muestra el curso fixture", async () => {
    await page.goto("/dashboard/catalogo");
    await expect(page.locator(`a[href="/cursos/${cursoSlug}"]`).first()).toBeVisible({
      timeout: 45_000,
    });
  });

  await test.step("la ficha del curso carga", async () => {
    await page.locator(`a[href="/cursos/${cursoSlug}"]`).first().click();
    await expect(page.getByRole("heading", { name: CURSO_FIXTURE.titulo })).toBeVisible({
      timeout: 45_000,
    });
  });

  await test.step("la lección introductoria carga y el video arranca", async () => {
    await page.goto(`/cursos/${CURSO_FIXTURE.id}/${leccion1.id}`);
    const reproductor = page.locator("mux-player");
    await expect(reproductor).toBeVisible({ timeout: 60_000 });
    await reproductor.click(); // gesto real de usuario: dispara play()

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("progreso")
            .select("id")
            .eq("id_usuario", usuarioId)
            .eq("id_leccion", leccion1.id)
            .maybeSingle();
          return data !== null;
        },
        {
          timeout: 30_000,
          message: "el progreso nunca se guardó: la reproducción no llegó a arrancar de verdad",
        },
      )
      .toBe(true);
  });
});
