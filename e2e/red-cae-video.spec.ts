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
 * Caso límite obligatorio: "Reproducción en móvil: ... red que se cae a
 * mitad de video." A diferencia de "pantalla bloqueada, cambio de app"
 * (ver docs/qa/bugs-e2e.md — eso sí necesita un dispositivo real), un corte
 * de red SÍ es fiel de reproducir con `context.setOffline()`: el navegador
 * dispara los eventos `offline`/`online` reales, exactamente lo que
 * VideoPlayer.tsx escucha para reintentar el guardado de progreso
 * (comentario "Si el navegador estuvo sin conexión y la vuelve a tener" en
 * ese archivo).
 *
 * Usa la lección introductoria del curso fixture (lecciones[0]): es vista
 * previa pública (esLeccionIntroductoria, lib/video/reproduccion.ts) así
 * que no hace falta canjear ningún código para reproducirla — solo sesión
 * iniciada, que es lo único que guardarSegundoActual() exige.
 *
 * La prueba no depende de que el video "se congele" de verdad estando sin
 * red (un clip de 9s puede llegar precargado del todo) ni de que
 * `segundo_actual` cambie de valor: lo que prueba es que VOLVER a tener red
 * dispara un guardado nuevo de inmediato (no espera el throttle normal de
 * 10s de INTERVALO_GUARDADO_MS) — se verifica con `actualizado_en`
 * (trigger `set_actualizado_en`, 20260824010000_estandariza_timestamps),
 * que cambia en cada UPDATE aunque el valor de `segundo_actual` sea el
 * mismo.
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-redcae-${sufijo}@uva.test`;
const password = "Abcdefg1!x";
const [leccion1] = CURSO_FIXTURE.lecciones;

let usuarioId: string;

test.beforeAll(async () => {
  await verificarCursoFixture(admin);
  const usuario = await crearUsuarioConfirmado(admin, { email, password });
  usuarioId = usuario.id;
});

test.afterAll(async () => {
  await limpiarDatosDeUsuario(admin, usuarioId);
  await borrarUsuarioPorEmail(admin, email);
});

test("al volver la conexión, el reproductor guarda el progreso de inmediato sin esperar el throttle normal", async ({
  page,
  context,
}) => {
  await test.step("login", async () => {
    await page.goto("/login");
    await page.fill("#auth-email", email);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#login-pass")).toBeVisible();
    await page.fill("#login-pass", password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  });

  await test.step("abre la lección introductoria (pública) y empieza a reproducir", async () => {
    await page.goto(`/cursos/${CURSO_FIXTURE.id}/${leccion1.id}`);
    const reproductor = page.locator("mux-player");
    await expect(reproductor).toBeVisible({ timeout: 20_000 });
    await reproductor.click(); // gesto real de usuario: dispara play()
  });

  let actualizadoAntes: string;
  await test.step("espera el primer guardado de progreso real", async () => {
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("progreso")
            .select("actualizado_en")
            .eq("id_usuario", usuarioId)
            .eq("id_leccion", leccion1.id)
            .maybeSingle();
          actualizadoAntes = data?.actualizado_en ?? "";
          return data !== null;
        },
        { timeout: 15_000, message: "el primer guardado de progreso nunca llegó a la base" },
      )
      .toBe(true);
  });

  await test.step("la red se cae a mitad de video", async () => {
    await context.setOffline(true);
    // Simula unos segundos de corte real antes de que vuelva la red — el
    // throttle normal (10s) todavía no vencería en este punto, así que
    // cualquier guardado nuevo que aparezca después de reconectar solo puede
    // venir del listener de "online", no de un ciclo periódico normal.
    await page.waitForTimeout(2000);
  });

  await test.step("vuelve la conexión: el guardado se reintenta de inmediato, sin esperar el throttle", async () => {
    await context.setOffline(false);
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("progreso")
            .select("actualizado_en")
            .eq("id_usuario", usuarioId)
            .eq("id_leccion", leccion1.id)
            .maybeSingle();
          return data?.actualizado_en ?? "";
        },
        {
          timeout: 6_000,
          message:
            "actualizado_en no cambió tras reconectar: el listener de 'online' no reintentó el guardado",
        },
      )
      .not.toBe(actualizadoAntes!);
  });
});
