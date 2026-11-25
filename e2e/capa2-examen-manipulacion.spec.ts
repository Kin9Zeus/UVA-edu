import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { adminClient, borrarUsuarioPorEmail, crearUsuarioConfirmado, limpiarDatosDeUsuario } from "./supabase-admin";
import { esperarTurnstile } from "./turnstile";

/**
 * Capa 2 — el examen final (lo que emite certificados) como lo usaría un
 * estudiante real: aprobarlo, doble clic, recargar a mitad, dos pestañas,
 * quedarse sin red al responder y la sesión que caduca con el examen
 * abierto. Corre en CI (P2-13, AUDIT-2026-11-23).
 *
 * NO usa el examen del curso fixture: publicarlo, aunque fuera por unos
 * minutos, cambiaría lo que ven los demás usuarios de staging. Se crea un
 * curso desechable con `mostrado = false` — invisible en el catálogo; solo
 * lo ven los usuarios de prueba porque tienen progreso en él
 * (private.tiene_acceso_vigente_curso, supabase/sql/030) — y se borra al
 * terminar junto con su examen, intentos y certificados.
 */

const admin = adminClient();
const sufijo = Date.now();
const password = "Abcdefg1!x";
const cursoSlug = `curso-e2e-capa2-examen-${sufijo}`;

let cursoId = "";
let moduloId = "";
let leccionId = "";
let examenId = "";
let planId = "";
const usuarios: { email: string; id: string }[] = [];

const PREGUNTAS = [
  { texto: "Pregunta uno de prueba", correcta: "p1-si", incorrecta: "p1-no" },
  { texto: "Pregunta dos de prueba", correcta: "p2-si", incorrecta: "p2-no" },
];

const esServerAction = (headers: Record<string, string>) => "next-action" in headers;
const RUTA_EXAMEN = `/cursos/${cursoSlug}/examen`;

test.beforeAll(async () => {
  const { data: creador, error: errCreador } = await admin
    .from("perfiles")
    .select("id")
    .eq("rol", "ADMINISTRADOR")
    .limit(1)
    .single();
  if (errCreador || !creador) throw new Error(`No hay un administrador para firmar el curso de prueba: ${errCreador?.message}`);

  const { data: plan } = await admin.from("planes").select("id").limit(1).single();
  planId = plan!.id;

  const { data: curso, error: errCurso } = await admin
    .from("cursos")
    .insert({
      titulo: `Curso E2E capa 2 examen ${sufijo}`,
      slug: cursoSlug,
      descripcion: "Curso desechable de pruebas E2E.",
      imagen_portada: "x",
      mostrado: false,
      id_admin_creador: creador.id,
    })
    .select("id")
    .single();
  if (errCurso || !curso) throw new Error(`No pude crear el curso de prueba: ${errCurso?.message}`);
  cursoId = curso.id;

  const { data: modulo, error: errModulo } = await admin
    .from("modulos")
    .insert({ id_curso: cursoId, titulo: "Módulo E2E", orden: 1 })
    .select("id")
    .single();
  if (errModulo || !modulo) throw new Error(`No pude crear el módulo: ${errModulo?.message}`);
  moduloId = modulo.id;

  const { data: leccion, error: errLeccion } = await admin
    .from("lecciones")
    .insert({ id_modulo: moduloId, titulo: "Lección E2E", slug: `leccion-e2e-${sufijo}`, orden: 1, estado_procesamiento: "LISTO" })
    .select("id")
    .single();
  if (errLeccion || !leccion) throw new Error(`No pude crear la lección: ${errLeccion?.message}`);
  leccionId = leccion.id;

  const { data: examen, error: errExamen } = await admin
    .from("examenes")
    .insert({
      id_curso: cursoId,
      titulo: `Examen E2E ${sufijo}`,
      nota_aprobatoria: 75,
      intentos_maximos: 3,
      minutos_limite: null,
      aleatorizar_preguntas: false,
      aleatorizar_opciones: false,
      publicado: true,
    })
    .select("id")
    .single();
  if (errExamen || !examen) throw new Error(`No pude crear el examen: ${errExamen?.message}`);
  examenId = examen.id;

  const { error: errPreguntas } = await admin.from("preguntas_examen").insert(
    PREGUNTAS.map((p, i) => ({
      id_examen: examenId,
      tipo: "OPCION_UNICA",
      enunciado: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: p.texto }] }] },
      puntos: 1,
      orden: i + 1,
      opciones: [
        { id: p.correcta, texto: `Correcta ${i + 1}`, correcta: true },
        { id: p.incorrecta, texto: `Incorrecta ${i + 1}`, correcta: false },
      ],
      respuestas_aceptadas: [],
      validada: null, // `validada` exige lección de origen (CHECK preguntas_examen_validada_exige_origen); escrita a mano no la tiene.
    })),
  );
  if (errPreguntas) throw new Error(`No pude crear las preguntas: ${errPreguntas.message}`);
});

test.afterAll(async () => {
  for (const u of usuarios) {
    await admin.from("intentos_examen").delete().eq("id_usuario", u.id);
    await limpiarDatosDeUsuario(admin, u.id);
    await borrarUsuarioPorEmail(admin, u.email);
  }
  if (cursoId) {
    await admin.from("examenes").delete().eq("id_curso", cursoId); // cascada a preguntas e intentos
    await admin.from("lecciones").delete().eq("id_modulo", moduloId);
    await admin.from("modulos").delete().eq("id_curso", cursoId);
    const { error } = await admin.from("cursos").delete().eq("id", cursoId);
    if (error) console.error(`No pude borrar el curso de prueba ${cursoId}: ${error.message}`);
  }
});

/** Estudiante con suscripción vigente y la única lección del curso completa: listo para rendir. */
async function estudianteListo(etiqueta: string) {
  const email = `e2e-capa2-examen-${etiqueta}-${sufijo}@uva.test`;
  const user = await crearUsuarioConfirmado(admin, { email, password });
  usuarios.push({ email, id: user.id });

  const { error: errSus } = await admin.from("suscripciones").insert({
    id_usuario: user.id,
    id_plan: planId,
    fecha_inicio: new Date().toISOString(),
    fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    estado: "ACTIVA",
    proveedor: "manual",
    monto_centavos: 0,
    moneda: "COP",
    acceso_manual: true,
  });
  if (errSus) throw new Error(`No pude dar acceso al estudiante: ${errSus.message}`);

  const { error: errProg } = await admin
    .from("progreso")
    .insert({ id_usuario: user.id, id_leccion: leccionId, completado: true, segundo_actual: 0 });
  if (errProg) throw new Error(`No pude marcar la lección completa: ${errProg.message}`);

  return { email, id: user.id };
}

async function iniciarSesion(page: Page, email: string, destino = RUTA_EXAMEN) {
  await page.goto(`/login?redirect=${encodeURIComponent(destino)}`);
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await esperarTurnstile(page);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(new RegExp(RUTA_EXAMEN), { timeout: 60_000 });
}

async function empezarExamen(page: Page) {
  await page.getByRole("button", { name: /Iniciar (nuevo intento|examen)/ }).click();
  await expect(page.getByText(PREGUNTAS[0].texto)).toBeVisible({ timeout: 30_000 });
}

async function intentosDe(usuarioId: string) {
  const { data } = await admin
    .from("intentos_examen")
    .select("id, estado, respuestas, puntaje_pct")
    .eq("id_usuario", usuarioId)
    .eq("id_examen", examenId);
  return data ?? [];
}

function vigilarExcepciones(page: Page) {
  const excepciones: string[] = [];
  page.on("pageerror", (err) => excepciones.push(err.message));
  return excepciones;
}

async function cortarServerActions(target: Page | BrowserContext) {
  await target.route("**/*", (route) =>
    route.request().method() === "POST" && esServerAction(route.request().headers())
      ? route.abort("internetdisconnected")
      : route.continue(),
  );
}

test("doble clic en 'Iniciar examen' abre un solo intento", async ({ page }) => {
  const { email, id } = await estudianteListo("dobleinicio");
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);

  await page.getByRole("button", { name: "Iniciar examen" }).dblclick();
  await expect(page.getByText(PREGUNTAS[0].texto)).toBeVisible({ timeout: 30_000 });

  expect(await intentosDe(id)).toHaveLength(1);
  expect(excepciones).toEqual([]);
});

/** Botón de una opción. «Correcta 1» no casa con «Incorrecta 1» (mayúscula). */
const opcion = (page: Page, texto: string) => page.getByRole("button", { name: new RegExp(`${texto}$`) });

type Progreso = { resueltas: Record<string, unknown>; fallos: number; cola: string[] };
async function progresoDe(usuarioId: string) {
  const [intento] = await intentosDe(usuarioId);
  return { estado: intento?.estado as string | undefined, ...((intento?.respuestas ?? {}) as Progreso) };
}

async function responderTodoBien(page: Page) {
  await opcion(page, "Correcta 1").click();
  await page.getByRole("button", { name: /^Siguiente/ }).click();
  await expect(page.getByText(PREGUNTAS[1].texto)).toBeVisible({ timeout: 30_000 });
  await opcion(page, "Correcta 2").click();
  await expect(page.getByRole("button", { name: /^Ver resultado/ })).toBeVisible({ timeout: 30_000 });
}

test("aprobar el examen lo cierra APROBADO y emite el certificado", async ({ page }) => {
  const { email, id } = await estudianteListo("aprueba");
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);
  await empezarExamen(page);

  await responderTodoBien(page);

  const [intento] = await intentosDe(id);
  expect(intento.estado).toBe("APROBADO");
  expect(Number(intento.puntaje_pct)).toBe(100);
  // El trigger de la base emite el certificado al aprobar (068/114).
  const { data: certificados } = await admin.from("certificados").select("id").eq("id_usuario", id).eq("id_curso", cursoId);
  expect(certificados).toHaveLength(1);
  expect(excepciones).toEqual([]);
});

test("recargar a mitad del examen sigue en el mismo intento y en la pregunta siguiente", async ({ page }) => {
  const { email, id } = await estudianteListo("recarga");
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);
  await empezarExamen(page);

  await opcion(page, "Correcta 1").click();
  await expect(page.getByRole("button", { name: /^Siguiente/ })).toBeVisible({ timeout: 30_000 });

  await page.reload();
  await expect(page.getByText(PREGUNTAS[1].texto)).toBeVisible({ timeout: 30_000 });
  expect(await intentosDe(id)).toHaveLength(1);
  expect(Object.keys((await progresoDe(id)).resueltas)).toHaveLength(1);
  expect(excepciones).toEqual([]);
});

test("doble toque en una opción incorrecta cobra UNA sola vida", async ({ page }) => {
  const { email, id } = await estudianteListo("dobletoque");
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);
  await empezarExamen(page);

  await opcion(page, "Incorrecta 1").dblclick();
  await expect(page.getByRole("button", { name: /^Siguiente/ })).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2_000);

  expect((await progresoDe(id)).fallos).toBe(1);
  expect(excepciones).toEqual([]);
});

test("se cae la red al responder: avisa, no se congela y al volver la red se puede responder", async ({ page }) => {
  const { email, id } = await estudianteListo("sinred");
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);
  await empezarExamen(page);

  await cortarServerActions(page);
  await opcion(page, "Correcta 1").click();
  // Next monta su propio anunciador de rutas con role="alert": se filtra por el texto.
  await expect(page.getByRole("alert").filter({ hasText: /conexión/ })).toBeVisible({ timeout: 15_000 });
  await expect(opcion(page, "Correcta 1")).toBeEnabled();

  await page.unroute("**/*");
  await opcion(page, "Correcta 1").click();
  await expect(page.getByRole("button", { name: /^Siguiente/ })).toBeVisible({ timeout: 30_000 });
  const progreso = await progresoDe(id);
  expect(Object.keys(progreso.resueltas)).toHaveLength(1);
  expect(progreso.fallos).toBe(0);
  expect(excepciones).toEqual([]);
});

test("dos pestañas: aprobar en una y responder mal en la otra no recalifica", async ({ browser }) => {
  const { email, id } = await estudianteListo("dospestanas");
  const context = await browser.newContext();
  const pestanaA = await context.newPage();
  const excepciones = vigilarExcepciones(pestanaA);
  await iniciarSesion(pestanaA, email);
  await empezarExamen(pestanaA);

  const pestanaB = await context.newPage();
  excepciones.push(...vigilarExcepciones(pestanaB));
  await pestanaB.goto(RUTA_EXAMEN);
  await expect(pestanaB.getByText(PREGUNTAS[0].texto)).toBeVisible({ timeout: 30_000 });

  await responderTodoBien(pestanaA);
  await opcion(pestanaB, "Incorrecta 1").click();

  await expect(pestanaB.getByText("Este intento ya fue enviado")).toBeVisible({ timeout: 20_000 });
  const intentos = await intentosDe(id);
  expect(intentos).toHaveLength(1);
  expect(intentos[0].estado).toBe("APROBADO");
  expect(Number(intentos[0].puntaje_pct)).toBe(100);
  expect((await progresoDe(id)).fallos).toBe(0);
  expect(excepciones).toEqual([]);
  await context.close();
});

test("la sesión se cierra con el examen abierto: responder no deja la pantalla congelada", async ({ browser }) => {
  const { email, id } = await estudianteListo("sesion");
  const context = await browser.newContext();
  const page = await context.newPage();
  const excepciones = vigilarExcepciones(page);
  await iniciarSesion(page, email);
  await empezarExamen(page);

  await context.clearCookies();
  await opcion(page, "Correcta 1").click();

  // Vale un aviso o que lo lleve a /login; no vale "Calificando…" para siempre.
  await expect(
    page.getByRole("alert").filter({ hasNotText: "UVA" }).or(page.locator("#auth-email")).first(),
  ).toBeVisible({ timeout: 20_000 });
  const progreso = await progresoDe(id);
  expect(progreso.estado).toBe("EN_CURSO");
  expect(Object.keys(progreso.resueltas ?? {})).toHaveLength(0);
  expect(excepciones).toEqual([]);
  await context.close();
});
