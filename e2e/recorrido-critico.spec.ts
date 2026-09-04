import { expect, test } from "@playwright/test";
import {
  adminClient,
  borrarCodigoInvitacion,
  borrarUsuarioPorEmail,
  crearCodigoInvitacion,
  CURSO_FIXTURE,
  formatearCodigoDePrueba,
  generarEnlaceConfirmacion,
  limpiarDatosDeUsuario,
  obtenerSlugsCursoFixture,
  verificarCursoFixture,
} from "./supabase-admin";

/**
 * Recorrido crítico completo del MVP (tarea "Pruebas end-to-end del flujo de
 * canje de código y acceso"): recibe código -> se registra -> verifica su
 * correo -> canjea el código -> entra al catálogo -> abre un curso ->
 * reproduce una lección -> cierra y vuelve -> retoma donde quedó -> completa
 * el curso -> recibe su certificado.
 *
 * "Si este recorrido no funciona sin fricción, no hay lanzamiento" (la
 * propia tarea) — por eso es el único spec de los tres que no crea contenido
 * desechable para el video: reusa CURSO_FIXTURE, un curso semilla real con
 * lecciones ya procesadas en Mux (video real y corto), para ejercitar el
 * reproductor, el guardado de progreso y la emisión de certificado contra el
 * camino real de la app — no una simulación de "video terminado".
 *
 * Corre contra el proyecto real de Supabase (no hay staging separado, ver
 * AUDIT-2026-08-24.md) con un usuario y un código desechables; el curso
 * fixture NUNCA se toca (no se crea ni se borra), solo se le agregan y
 * limpian filas de `progreso`/`suscripciones`/`certificados` del usuario de
 * prueba.
 */

const admin = adminClient();
const sufijo = Date.now();
const email = `e2e-recorrido-${sufijo}@uva.test`;
const password = "Abcdefg1!x"; // cumple las 4 reglas de src/lib/password.ts
const nombre = "Estudiante Recorrido E2E";
// Con guiones en las mismas posiciones que el input real produce
// (formatearCodigoDePrueba) — ver su comentario en supabase-admin.ts.
const codigo = formatearCodigoDePrueba(`R${Date.now().toString(36).toUpperCase()}`);

const [leccion1, leccion2, leccion3] = CURSO_FIXTURE.lecciones;

let codigoId: string;
let usuarioId: string | null = null;
// Las páginas públicas aceptan el UUID como respaldo, pero todo <Link> real
// de la app (catálogo, "Comenzar curso") navega por slug — se consultan acá
// para que los pasos que hacen clic en esos enlaces (en vez de un
// page.goto directo) apunten a la URL que la UI realmente produce.
let cursoSlug = "";
let leccionSlugs: Record<string, string> = {};

test.beforeAll(async () => {
  await verificarCursoFixture(admin);
  const fila = await crearCodigoInvitacion(admin, { codigo, limiteUsos: 1, duracionDias: 30 });
  codigoId = fila.id;
  ({ cursoSlug, leccionSlugs } = await obtenerSlugsCursoFixture(admin));
});

test.afterAll(async () => {
  if (usuarioId) await limpiarDatosDeUsuario(admin, usuarioId);
  await borrarCodigoInvitacion(admin, codigoId);
  await borrarUsuarioPorEmail(admin, email);
});

test("recorrido crítico: código -> registro -> canje -> catálogo -> curso -> lección -> retoma -> completa -> certificado", async ({
  page,
}) => {
  await test.step("recibe el código y se registra", async () => {
    await page.goto("/login");
    await page.fill("#auth-email", email);
    await page.getByRole("button", { name: "Continuar", exact: true }).click();
    await expect(page.locator("#reg-nombre")).toBeVisible();

    await page.fill("#reg-nombre", nombre);
    await page.fill("#reg-pass", password);
    await page.fill("#reg-pass2", password);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(
      page.getByText(`Te enviamos un correo de confirmación a ${email}`),
    ).toBeVisible();
  });

  await test.step("verifica su correo y entra", async () => {
    const origin = new URL(page.url()).origin;
    const enlace = await generarEnlaceConfirmacion(admin, {
      email,
      password,
      origin,
      next: `/login?signout=1&email=${encodeURIComponent(email)}`,
    });
    await page.goto(enlace);
    // /auth/confirm ya no verifica solo por visitar la URL (evita que un
    // escáner de enlaces de correo consuma el token antes que la persona
    // real, ver Sentry UVA-EDU-10/13/14) — hace falta el clic.
    await page.getByRole("button", { name: "Confirmar" }).click();
    await expect(page).toHaveURL(/\/login\?email=/);
    await page.fill("#login-pass", password);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    usuarioId = data?.users.find((u) => u.email === email)?.id ?? null;
    expect(usuarioId).not.toBeNull();
  });

  await test.step("canjea el código de invitación", async () => {
    await page.goto("/dashboard/suscripcion");
    await page.fill("#codigo-invitacion", codigo);
    await page.getByRole("button", { name: "Canjear" }).click();
    // SuscripcionContent pasa de "no tienes suscripción" al plan otorgado
    // (router.refresh() en CanjearCodigoForm) — el candado del catálogo cae
    // apenas esto sea visible.
    await expect(page.getByText("Acceso por invitación")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("entra al catálogo y encuentra el curso", async () => {
    await page.goto("/dashboard/catalogo");
    await expect(page.locator(`a[href="/cursos/${cursoSlug}"]`).first()).toBeVisible();
  });

  await test.step("abre el curso", async () => {
    await page.locator(`a[href="/cursos/${cursoSlug}"]`).first().click();
    await expect(page).toHaveURL(`/cursos/${cursoSlug}`, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: CURSO_FIXTURE.titulo })).toBeVisible();
  });

  await test.step("reproduce la primera lección (video real y corto)", async () => {
    await page.getByRole("button", { name: "Comenzar curso" }).click();
    await expect(page).toHaveURL(`/cursos/${cursoSlug}/${leccionSlugs[leccion1.id]}`, { timeout: 15_000 });

    const reproductor = page.locator("mux-player");
    await expect(reproductor).toBeVisible({ timeout: 20_000 });
    await reproductor.click(); // gesto real de usuario: dispara play()

    // El primer guardado de progreso (sin esperar el throttle de 10s, ver
    // VideoPlayer.tsx) cae casi al segundo 0 (Math.floor(0.x) = 0), así que
    // no sirve para probar "retoma donde quedó". Se deja correr un poco de
    // los 9s del video y se navega fuera a continuación — eso es lo que de
    // verdad guarda una posición distinta de 0 (ver el siguiente paso).
    await page.waitForTimeout(4000);
  });

  let segundoAlCerrar = 0;
  await test.step("cierra y vuelve", async () => {
    // Navegar fuera dispara un `pagehide` real, que guarda la posición con
    // `sendBeacon` (guardarAlSalir, VideoPlayer.tsx) sin depender del
    // throttle de 10s — en un video de 9s ese throttle nunca llegaría a
    // dispararse una segunda vez.
    await page.goto("/dashboard");
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("progreso")
            .select("segundo_actual")
            .eq("id_usuario", usuarioId!)
            .eq("id_leccion", leccion1.id)
            .maybeSingle();
          segundoAlCerrar = data?.segundo_actual ?? 0;
          return segundoAlCerrar;
        },
        { timeout: 10_000, message: "sendBeacon nunca guardó la posición al salir de la lección" },
      )
      .toBeGreaterThan(0);

    await page.goto(`/cursos/${CURSO_FIXTURE.id}/${leccion1.id}`);
  });

  await test.step("retoma donde quedó", async () => {
    // startTime es el prop que VideoPlayer.tsx recibe de getLeccionPlayer()
    // (server-side, de la fila `progreso` real) — comprobar esto prueba el
    // camino completo servidor -> reproductor, no una carrera de reproducción.
    const reproductor = page.locator("mux-player");
    await expect(reproductor).toBeVisible({ timeout: 20_000 });
    const startTime = await reproductor.evaluate((el) => (el as unknown as { startTime: number }).startTime);
    expect(startTime).toBeGreaterThanOrEqual(segundoAlCerrar - 1);
  });

  await test.step("completa el curso", async () => {
    // Termina de ver la lección 1 (real, a través de la UI): el umbral de
    // "completada" es 90% de la duración (VideoPlayer.tsx).
    await page.locator("mux-player").click();
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("progreso")
            .select("completado")
            .eq("id_usuario", usuarioId!)
            .eq("id_leccion", leccion1.id)
            .maybeSingle();
          return data?.completado ?? false;
        },
        { timeout: 20_000, message: "la lección 1 nunca quedó marcada completada" },
      )
      .toBe(true);

    // Lección 2 ("ANDRES", 31s): completada por fixture directo, no
    // reproduciéndola de verdad — el mecanismo de reproducción ya quedó
    // probado con la lección 1, y repetirlo acá solo alargaría el spec sin
    // cubrir nada nuevo (ver docs/qa/bugs-e2e.md, sección de alcance).
    const { error: errorFixtureLeccion2 } = await admin
      .from("progreso")
      .upsert(
        { id_usuario: usuarioId!, id_leccion: leccion2.id, completado: true, segundo_actual: leccion2.duracionSeg },
        { onConflict: "id_usuario,id_leccion" },
      );
    expect(errorFixtureLeccion2).toBeNull();

    // Lección 3, la última: se completa de verdad por la UI real. Es la que
    // deja el curso en 100% y debe disparar el trigger de emisión de
    // certificado (047_emision_automatica_certificados.sql) — que el
    // certificado exista de verdad es la prueba de que el trigger corrió,
    // no un valor sembrado a mano.
    await page.goto(`/cursos/${CURSO_FIXTURE.id}/${leccion3.id}`);
    const reproductorLeccion3 = page.locator("mux-player");
    await expect(reproductorLeccion3).toBeVisible({ timeout: 20_000 });
    await reproductorLeccion3.click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("progreso")
            .select("completado")
            .eq("id_usuario", usuarioId!)
            .eq("id_leccion", leccion3.id)
            .maybeSingle();
          return data?.completado ?? false;
        },
        { timeout: 20_000, message: "la lección 3 (última del curso) nunca quedó marcada completada" },
      )
      .toBe(true);
  });

  let certificadoId: string | null = null;
  await test.step("recibe su certificado", async () => {
    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("certificados")
            .select("id")
            .eq("id_usuario", usuarioId!)
            .eq("id_curso", CURSO_FIXTURE.id)
            .maybeSingle();
          certificadoId = data?.id ?? null;
          return certificadoId;
        },
        {
          timeout: 20_000,
          message: "el trigger de emisión automática de certificados (047) nunca creó la fila",
        },
      )
      .not.toBeNull();

    await page.goto("/dashboard/certificados");
    await expect(page.getByText(CURSO_FIXTURE.titulo)).toBeVisible();

    const descargaPromesa = page.waitForEvent("download", { timeout: 15_000 });
    await page.getByRole("button", { name: "Descargar PDF" }).click();
    const descarga = await descargaPromesa;
    expect(descarga.suggestedFilename()).toMatch(/^certificado-uva-.*\.pdf$/);
  });
});
