import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  limpiarDatosDeUsuario,
  promoverAAdministrador,
} from "./supabase-admin";

/**
 * Lo que el barrido (a11y-barrido.spec.ts) no ve porque no está pintado al
 * cargar:
 *   1. Cada diálogo, menú y panel que se abre con un botón: se abre con Enter,
 *      el foco debe entrar, axe revisa lo abierto, Esc lo cierra y el foco
 *      vuelve al botón (WCAG 2.1.1, 2.1.2, 2.4.3, 4.1.2).
 *   2. El examen de principio a fin solo con teclado, sobre un curso y un
 *      examen desechables (mismo patrón que capa2-examen-manipulacion).
 *
 *   npm run build && npm run start      (en otra terminal)
 *   A11Y=1 npx playwright test e2e/a11y-estados.spec.ts
 *
 * Informe en test-results/a11y/estados.json.
 */

type Rol = "anonimo" | "estudiante" | "admin";
interface Hallazgo {
  rol: Rol;
  ruta: string;
  ancho: number;
  control: string;
  tipo: "axe" | "no-abre" | "foco-fuera" | "esc-no-cierra" | "foco-no-vuelve" | "examen" | "error";
  detalle: string;
}

const AXE_PATH = join(process.cwd(), "node_modules/axe-core/axe.min.js");
const admin = adminClient();
const sufijo = Date.now();
const password = "Abcdefg1!x";
const emails = { estudiante: `e2e-a11y-est-${sufijo}@uva.test`, admin: `e2e-a11y-adm-${sufijo}@uva.test` };
const ids: Partial<Record<Rol, string>> = {};
const sesiones: Partial<Record<Rol, BrowserContextOptions["storageState"]>> = {};
const hallazgos: Hallazgo[] = [];

const cursoSlug = `curso-e2e-a11y-examen-${sufijo}`;
let cursoId = "";
let moduloId = "";
let leccionSlug = "";
let examenId = "";

const PARES = [
  { id: "par-1", izquierda: "Sol", derecha: "Luz directa" },
  { id: "par-2", izquierda: "HDRI", derecha: "Luz del entorno" },
];

const RUTAS: Record<Rol, string[]> = {
  anonimo: ["/", "/catalogo", "/login"],
  estudiante: ["/dashboard", "/dashboard/comunidad", "/dashboard/perfil", "/dashboard/notas"],
  admin: ["/admin", "/admin/codigos", "/admin/cupones", "/admin/categorias", "/admin/planes", "/admin/usuarios", "/admin/cursos"],
};

async function iniciarSesion(browser: Browser, email: string) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill("#auth-email", email);
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await expect(page.locator("#login-pass")).toBeVisible({ timeout: 30_000 });
  await page.fill("#login-pass", password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 60_000 });
  const estado = await context.storageState();
  await context.close();
  return estado;
}

/** Violaciones critical/serious de axe dentro de `selector` (o de toda la página). */
async function axeGraves(page: Page, selector?: string) {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async (sel) => {
    // @ts-expect-error axe lo inyecta addScriptTag
    const r = await window.axe.run(sel ? document.querySelector(sel) ?? document : document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    });
    return (r.violations as Array<{ id: string; impact: string; nodes: Array<{ target: string[] }> }>)
      .filter((v) => v.impact === "critical" || v.impact === "serious")
      .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
  }, selector);
}

const SELECTOR_DISPARADOR = "button[aria-haspopup]:not([disabled]), button[aria-expanded]:not([disabled])";
const SELECTOR_EMERGENTE = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';

async function nombreDe(page: Page, indice: number) {
  return page.evaluate(
    ([sel, i]) => {
      const visibles = [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => el.offsetParent !== null);
      const el = visibles[i];
      return el ? (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60) : null;
    },
    [SELECTOR_DISPARADOR, indice] as const,
  );
}

async function revisarEmergentes(page: Page, rol: Rol, ruta: string, ancho: number) {
  await page.goto(ruta, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  const total = await page.evaluate(
    (sel) => [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => el.offsetParent !== null).length,
    SELECTOR_DISPARADOR,
  );

  for (let i = 0; i < Math.min(total, 15); i++) {
    // Página limpia por control: si uno no cierra con Esc, no contamina al siguiente.
    if (i > 0) {
      await page.goto(ruta, { waitUntil: "load" });
      await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    }
    const control = await nombreDe(page, i);
    if (!control) continue;
    const anotar = (tipo: Hallazgo["tipo"], detalle: string) => hallazgos.push({ rol, ruta, ancho, control, tipo, detalle });

    try {
      await page.evaluate(
        ([sel, n]) => {
          const visibles = [...document.querySelectorAll<HTMLElement>(sel)].filter((el) => el.offsetParent !== null);
          visibles[n].setAttribute("data-a11y-disparador", "");
          visibles[n].setAttribute("data-a11y-expandido-antes", visibles[n].getAttribute("aria-expanded") ?? "");
          visibles[n].focus();
        },
        [SELECTOR_DISPARADOR, i] as const,
      );
      await page.keyboard.press("Enter");
      await page.waitForTimeout(700);

      const leerEstado = () => page.evaluate((sel) => {
        const emergente = [...document.querySelectorAll<HTMLElement>(sel)].find((el) => el.offsetParent !== null || el.getClientRects().length > 0);
        const disparador = document.querySelector<HTMLElement>("[data-a11y-disparador]");
        if (emergente) emergente.setAttribute("data-a11y-emergente", "");
        // El botón de MenuCuenta se reemplaza al cargar el menú: se busca el que tenga el foco.
        const actual = disparador?.isConnected ? disparador : (document.activeElement as HTMLElement | null);
        return {
          abierto: Boolean(emergente),
          rol: emergente?.getAttribute("role") ?? null,
          // Un acordeón abierto de entrada (Para atender, Ocultar panel) se cierra: también cuenta.
          cambio: actual?.getAttribute("aria-expanded") !== (disparador?.getAttribute("data-a11y-expandido-antes") ?? ""),
          focoDentro: Boolean(emergente && emergente.contains(document.activeElement)),
        };
      }, SELECTOR_EMERGENTE);
      let estado = await leerEstado();
      if (!estado.abierto && !estado.cambio) {
        // Menús que cargan su código al usarlos (MenuCuenta): se les da más tiempo.
        await page.waitForTimeout(2000);
        estado = await leerEstado();
      }

      if (!estado.abierto) {
        // Un acordeón expande o recoge contenido en la misma página: no hay nada que cerrar con Esc.
        if (!estado.cambio) anotar("no-abre", "Enter no abrió nada ni cambió aria-expanded");
        continue;
      }
      // En un listbox (select) el foco puede quedarse en el disparador con aria-activedescendant.
      if (!estado.focoDentro && estado.rol !== "listbox") anotar("foco-fuera", `se abrió un ${estado.rol} pero el foco quedó fuera`);

      for (const v of await axeGraves(page, "[data-a11y-emergente]")) anotar("axe", v);

      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      const tras = await page.evaluate(
        ([selEmergente, nombre]) => {
          const sigueAbierto = [...document.querySelectorAll<HTMLElement>(selEmergente)].some((el) => el.offsetParent !== null || el.getClientRects().length > 0);
          const activo = document.activeElement as HTMLElement | null;
          const nombreActivo = (activo?.getAttribute("aria-label") ?? activo?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
          // MenuCuenta cambia su botón por el del menú: basta con que el foco esté en uno con el mismo nombre.
          const volvio = Boolean(activo?.hasAttribute("data-a11y-disparador")) || nombreActivo === nombre;
          return { sigueAbierto, volvio, nombreActivo };
        },
        [SELECTOR_EMERGENTE, control] as const,
      );
      if (tras.sigueAbierto) anotar("esc-no-cierra", "sigue abierto tras Esc");
      else if (!tras.volvio) anotar("foco-no-vuelve", `el foco quedó en "${tras.nombreActivo || "body"}"`);
    } catch (err) {
      anotar("error", (err as Error).message.split("\n")[0].slice(0, 200));
    }
  }
  return total;
}

function guardar() {
  mkdirSync("test-results/a11y", { recursive: true });
  writeFileSync("test-results/a11y/estados.json", JSON.stringify(hallazgos, null, 2));
}

test.describe.configure({ mode: "serial" });
// Solo bajo pedido (A11Y=1): tardan ~20 min y no son parte de `npm run test:e2e`
// de cada tarea; se usan en barridos de accesibilidad.
test.skip(!process.env.A11Y, "Barrido de accesibilidad: correr con A11Y=1");

test.beforeAll(async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  for (const rol of ["estudiante", "admin"] as const) {
    const user = await crearUsuarioConfirmado(admin, { email: emails[rol], password, nombre: `E2E Estados ${rol}` });
    ids[rol] = user.id;
  }
  await promoverAAdministrador(admin, ids.admin!);

  const { data: plan, error: errPlan } = await admin.from("planes").select("id").limit(1).single();
  if (errPlan || !plan) throw new Error(`No hay plan para otorgar acceso de prueba: ${errPlan?.message}`);
  const { error: errSus } = await admin.from("suscripciones").insert({
    id_usuario: ids.estudiante,
    id_plan: plan.id,
    fecha_inicio: new Date().toISOString(),
    fecha_renovacion: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    estado: "ACTIVA",
    proveedor: "manual",
    monto_centavos: 0,
    moneda: "COP",
    acceso_manual: true,
  });
  if (errSus) throw new Error(`No pude crear la suscripción de prueba: ${errSus.message}`);

  // Curso desechable con un examen de los tres tipos que se pueden crear.
  const { data: curso, error: errCurso } = await admin
    .from("cursos")
    .insert({
      titulo: `Curso E2E a11y examen ${sufijo}`,
      slug: cursoSlug,
      descripcion: "Curso desechable de pruebas E2E.",
      imagen_portada: "x",
      mostrado: false,
      id_admin_creador: ids.admin,
    })
    .select("id")
    .single();
  if (errCurso || !curso) throw new Error(`No pude crear el curso de prueba: ${errCurso?.message}`);
  cursoId = curso.id;
  const { data: modulo, error: errModulo } = await admin.from("modulos").insert({ id_curso: cursoId, titulo: "Módulo E2E", orden: 1 }).select("id").single();
  if (errModulo || !modulo) throw new Error(`No pude crear el módulo: ${errModulo?.message}`);
  moduloId = modulo.id;
  leccionSlug = `leccion-e2e-a11y-${sufijo}`;
  const { data: leccion, error: errLeccion } = await admin
    .from("lecciones")
    .insert({ id_modulo: moduloId, titulo: "Lección E2E", slug: leccionSlug, orden: 1, estado_procesamiento: "LISTO" })
    .select("id")
    .single();
  if (errLeccion || !leccion) throw new Error(`No pude crear la lección: ${errLeccion?.message}`);
  const { error: errProg } = await admin.from("progreso").insert({ id_usuario: ids.estudiante, id_leccion: leccion.id, completado: true, segundo_actual: 0 });
  if (errProg) throw new Error(`No pude marcar la lección completa: ${errProg.message}`);

  const { data: examen, error: errExamen } = await admin
    .from("examenes")
    .insert({
      id_curso: cursoId,
      titulo: `Examen E2E a11y ${sufijo}`,
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
  const enunciado = (texto: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: texto }] }] });
  const { error: errPreguntas } = await admin.from("preguntas_examen").insert([
    {
      id_examen: examenId,
      tipo: "OPCION_UNICA",
      enunciado: enunciado("Pregunta de opción única"),
      puntos: 1,
      orden: 1,
      opciones: [
        { id: "u-si", texto: "Respuesta buena", correcta: true },
        { id: "u-no", texto: "Respuesta mala", correcta: false },
      ],
      respuestas_aceptadas: [],
      validada: null,
    },
    {
      id_examen: examenId,
      tipo: "VERDADERO_FALSO",
      enunciado: enunciado("Pregunta de verdadero o falso"),
      puntos: 1,
      orden: 2,
      opciones: [
        { id: "v", texto: "Verdadero", correcta: true },
        { id: "f", texto: "Falso", correcta: false },
      ],
      respuestas_aceptadas: [],
      validada: null,
    },
    {
      id_examen: examenId,
      tipo: "EMPAREJAR",
      enunciado: enunciado("Pregunta de relacionar"),
      puntos: 1,
      orden: 3,
      opciones: PARES,
      respuestas_aceptadas: [],
      validada: null,
    },
  ]);
  if (errPreguntas) throw new Error(`No pude crear las preguntas: ${errPreguntas.message}`);

  for (const rol of ["estudiante", "admin"] as const) sesiones[rol] = await iniciarSesion(browser, emails[rol]);
});

test.afterAll(async () => {
  test.setTimeout(5 * 60_000);
  guardar();
  if (ids.estudiante) await admin.from("intentos_examen").delete().eq("id_usuario", ids.estudiante);
  // El avance del estudiante apunta a las clases y bloqueaba borrar el curso;
  // los usuarios van al final porque el admin de prueba firma el curso.
  if (ids.estudiante) await limpiarDatosDeUsuario(admin, ids.estudiante);
  if (cursoId) {
    await admin.from("examenes").delete().eq("id_curso", cursoId);
    await admin.from("lecciones").delete().eq("id_modulo", moduloId);
    await admin.from("modulos").delete().eq("id_curso", cursoId);
    const { error } = await admin.from("cursos").delete().eq("id", cursoId);
    if (error) console.error(`No pude borrar el curso de prueba ${cursoId}: ${error.message}`);
  }
  for (const rol of ["estudiante", "admin"] as const) {
    if (ids[rol]) await limpiarDatosDeUsuario(admin, ids[rol]!);
    await borrarUsuarioPorEmail(admin, emails[rol]);
  }
});

for (const rol of ["anonimo", "estudiante", "admin"] as Rol[]) {
  test(`diálogos y menús con teclado como ${rol}`, async ({ browser }) => {
    test.setTimeout(30 * 60_000);
    for (const ancho of [1280, 390]) {
      const context = await browser.newContext({
        storageState: rol === "anonimo" ? undefined : sesiones[rol],
        viewport: { width: ancho, height: 900 },
      });
      const page = await context.newPage();
      const rutas = rol === "estudiante" ? [...RUTAS.estudiante, `/cursos/${cursoSlug}/${leccionSlug}`] : RUTAS[rol];
      for (const ruta of rutas) {
        const total = await revisarEmergentes(page, rol, ruta, ancho);
        console.log(`[${rol} ${ancho}] ${ruta}: ${total} controles que abren algo`);
      }
      await context.close();
      guardar();
    }
  });
}

/** Aprieta Tab hasta que el foco quede en un control cuyo nombre contiene `texto`. */
async function tabHasta(page: Page, texto: string, max = 80) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    const foco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const s = getComputedStyle(el);
      return {
        nombre: (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " "),
        // El anillo automático del navegador ("auto") no cuenta: era el que no se veía.
        visible: (s.outlineStyle !== "none" && s.outlineStyle !== "auto" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none",
      };
    });
    if (foco?.nombre.includes(texto)) {
      if (!foco.visible) hallazgos.push({ rol: "estudiante", ruta: "examen", ancho: 1280, control: texto, tipo: "examen", detalle: "foco sin anillo visible" });
      return;
    }
  }
  throw new Error(`Con Tab no se llegó a "${texto}"`);
}

test("el examen se completa solo con teclado", async ({ browser }) => {
  test.setTimeout(5 * 60_000);
  const context = await browser.newContext({ storageState: sesiones.estudiante, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const anotar = (detalle: string) => hallazgos.push({ rol: "estudiante", ruta: "examen", ancho: 1280, control: "examen", tipo: "examen", detalle });
  const revisarAxe = async (momento: string) => {
    // Cada pregunta entra con un fundido (animate-uva-entrar): a mitad, axe mide el texto semitransparente.
    await page.waitForTimeout(800);
    for (const v of await axeGraves(page)) anotar(`${momento}: ${v}`);
  };

  await page.goto(`/cursos/${cursoSlug}/examen`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
  await revisarAxe("portada del examen");
  await tabHasta(page, "Iniciar examen");
  await page.keyboard.press("Enter");

  for (const [enunciado, respuesta] of [
    ["Pregunta de opción única", "Respuesta buena"],
    ["Pregunta de verdadero o falso", "Verdadero"],
  ]) {
    await expect(page.getByText(enunciado)).toBeVisible({ timeout: 30_000 });
    await revisarAxe(enunciado);
    await tabHasta(page, respuesta);
    await page.keyboard.press("Enter");
    // Con el veredicto el foco salta solo a "Siguiente": Enter avanza.
    await expect(page.locator(":focus")).toHaveText(/Siguiente|Ver resultado/, { timeout: 15_000 });
    await revisarAxe(`${enunciado} con veredicto`);
    await page.keyboard.press("Enter");
  }

  await expect(page.getByText("Pregunta de relacionar")).toBeVisible({ timeout: 30_000 });
  await revisarAxe("Pregunta de relacionar");
  for (const par of PARES) {
    await tabHasta(page, par.izquierda);
    await page.keyboard.press("Enter");
    await tabHasta(page, par.derecha);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
  }
  await expect(page.locator(":focus")).toHaveText(/Ver resultado/, { timeout: 15_000 });
  await page.keyboard.press("Enter");
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  await revisarAxe("resultado");

  const { data: intento } = await admin.from("intentos_examen").select("estado, puntaje_pct").eq("id_usuario", ids.estudiante!).eq("id_examen", examenId).maybeSingle();
  expect(intento?.puntaje_pct, "el intento hecho con teclado debe quedar calificado al 100 %").toBe(100);
  await context.close();
});

test("diálogos, menús y examen sin problemas de teclado", async () => {
  guardar();
  for (const h of hallazgos) console.log(`  [${h.rol} ${h.ancho}] ${h.ruta} — ${h.control}: ${h.tipo} ${h.detalle}`);
  expect(hallazgos.filter((h) => h.tipo !== "no-abre")).toEqual([]);
});
