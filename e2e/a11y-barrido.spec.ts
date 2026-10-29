import { join } from "node:path";
import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import {
  adminClient,
  borrarUsuarioPorEmail,
  crearUsuarioConfirmado,
  CURSO_FIXTURE,
  limpiarDatosDeUsuario,
  promoverAAdministrador,
} from "./supabase-admin";
import { TEMA_STORAGE_KEY } from "../src/lib/tema";

/**
 * Barrido de accesibilidad (WCAG 2.2 AA): corre axe-core (el mismo motor de
 * la extensión axe DevTools) y un recorrido con Tab en cada pantalla, con el
 * rol que la ve de verdad, en tema oscuro y claro, a 1280 y 390 px.
 *
 * Por cada visita se anota:
 *   - axe           violación de axe (impacto critical/serious/moderate/minor)
 *   - revisar       lo que axe no puede decidir solo ("Needs review" en la
 *                   extensión; casi siempre contraste sobre imagen o degradado)
 *   - foco-invisible un elemento recibe foco con Tab sin outline ni ring
 *   - atrapado      Tab no saca el foco de un elemento
 *   - inalcanzable  un control visible que Tab nunca alcanza
 *
 * axe solo ve lo pintado al cargar: diálogos, menús y el examen en curso se
 * revisan aparte. Igual que capa1, conviene correrlo contra un build:
 *
 *   npm run build && npm run start      (en otra terminal)
 *   npx playwright test e2e/a11y-barrido.spec.ts
 *
 * Informe en test-results/a11y/hallazgos.json.
 */

type Rol = "anonimo" | "estudiante" | "admin";
const TODOS_LOS_ROLES: Rol[] = ["anonimo", "estudiante", "admin"];
// A11Y_ROLES=admin repite solo esos roles.
const ROLES = process.env.A11Y_ROLES
  ? TODOS_LOS_ROLES.filter((r) => process.env.A11Y_ROLES!.split(",").includes(r))
  : TODOS_LOS_ROLES;

type Variante = { tema: "oscuro" | "claro"; ancho: number; teclado: boolean };
const VARIANTES: Variante[] = [
  { tema: "oscuro", ancho: 1280, teclado: true },
  { tema: "claro", ancho: 1280, teclado: false },
  { tema: "oscuro", ancho: 390, teclado: true },
  { tema: "claro", ancho: 390, teclado: false },
];

type TipoHallazgo = "axe" | "revisar" | "foco-invisible" | "atrapado" | "inalcanzable" | "timeout";
interface Hallazgo {
  rol: Rol;
  ruta: string;
  variante: string;
  tipo: TipoHallazgo;
  regla?: string;
  impacto?: string;
  detalle: string;
  nodos?: string[];
}

const AXE_PATH = join(process.cwd(), "node_modules/axe-core/axe.min.js");
const admin = adminClient();
const sufijo = Date.now();
const password = "Abcdefg1!x";
const emails = {
  estudiante: `e2e-a11y-estudiante-${sufijo}@uva.test`,
  admin: `e2e-a11y-admin-${sufijo}@uva.test`,
};
const ids: Partial<Record<Rol, string>> = {};
const sesiones: Partial<Record<Rol, BrowserContextOptions["storageState"]>> = {};
const rutas: Record<Rol, string[]> = { anonimo: [], estudiante: [], admin: [] };
const hallazgos: Hallazgo[] = [];

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

async function correrAxe(page: Page) {
  await page.addScriptTag({ path: AXE_PATH });
  return page.evaluate(async () => {
    // @ts-expect-error axe lo inyecta addScriptTag
    const r = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
      resultTypes: ["violations", "incomplete"],
    });
    type Resultado = {
      id: string;
      impact: string;
      help: string;
      nodes: Array<{ target: string[]; html: string; failureSummary: string }>;
    };
    const resumir = (v: Resultado) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodos: v.nodes.slice(0, 6).map((n) => `${n.target.join(" ")} :: ${n.html.slice(0, 160)} :: ${n.failureSummary.slice(0, 200)}`),
      total: v.nodes.length,
    });
    return {
      violaciones: (r.violations as Resultado[]).map(resumir),
      revisar: (r.incomplete as Resultado[]).map(resumir),
    };
  });
}

/** Aprieta Tab hasta dar la vuelta y anota foco invisible, trampas y controles que nunca reciben foco. */
async function recorrerConTeclado(page: Page) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement | null)?.blur();
    window.scrollTo(0, 0);
  });
  const vistos: string[] = [];
  const nombresVistos = new Set<string>();
  const invisibles = new Set<string>();
  let atrapado: string | null = null;
  let repetido = 0;
  let anterior = "";

  let fin = "límite de 300 Tab";
  let ultimo = "";

  let vacias = 0;

  const leerFoco = () =>
    page.evaluate(async () => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const marca = el.dataset.a11yId ?? (el.dataset.a11yId = String(Math.random()).slice(2));
      const texto = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
      const desc = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}${el.getAttribute("role") ? `[role=${el.getAttribute("role")}]` : ""} "${texto}"`;
      // Algunos componentes dibujan el foco en un ancestro (has-[:focus-visible]
      // en las tarjetas del catálogo): se miran el elemento y tres niveles arriba.
      const tieneIndicador = () => {
        let nodo: Element | null = el;
        for (let nivel = 0; nodo && nivel < 4; nivel++, nodo = nodo.parentElement) {
          const s = getComputedStyle(nodo);
          // "auto" es el anillo del navegador: con outline-ring/50 no se veía.
          if ((s.outlineStyle !== "none" && s.outlineStyle !== "auto" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none") return true;
          // Barras de las gráficas (SVG): el foco es un borde de acento.
          if (nodo instanceof SVGElement && s.stroke !== "none" && parseFloat(s.strokeWidth) > 0 && (nodo as Element) === el) return true;
        }
        return false;
      };
      let visible = tieneIndicador();
      if (!visible) {
        // Los ring de Tailwind llevan transición: se da un respiro antes de juzgar.
        await new Promise((r) => setTimeout(r, 200));
        visible = tieneIndicador();
      }
      // Iframes (reproductor de Mux) pintan su propio foco adentro.
      if (el.tagName === "IFRAME" || el.tagName.includes("-")) visible = true;
      // Tab recorre día, mes y año dentro del mismo campo de fecha.
      const segmentos = el instanceof HTMLInputElement && /^(date|time|datetime-local|month|week)$/.test(el.type) ? 4 : 1;
      return { marca, desc, visible, segmentos, nombre: texto };
    });

  for (let i = 0; i < 300; i++) {
    await page.keyboard.press("Tab");
    let info = await leerFoco();
    if (!info) {
      // MenuCuenta cambia su botón por el del menú al recibir foco y se lo
      // devuelve al montar: se relee antes de dar el foco por perdido.
      await page.waitForTimeout(400);
      info = await leerFoco();
    }
    if (!info) {
      // Tras el último control Chromium pasa el foco a la barra del navegador:
      // dos Tab seguidos sin foco en la página = fin del recorrido.
      if (vistos.length > 0 && ++vacias >= 2) {
        fin = `salió del documento tras ${ultimo}`;
        break;
      }
      continue;
    }
    vacias = 0;
    if (vistos[0] === info.marca) {
      fin = "dio la vuelta";
      break;
    }
    if (info.marca === anterior) {
      if (++repetido >= 2 + info.segmentos) {
        atrapado = info.desc;
        break;
      }
    } else repetido = 0;
    anterior = info.marca;
    ultimo = info.desc;
    if (!vistos.includes(info.marca)) vistos.push(info.marca);
    nombresVistos.add(info.nombre);
    if (!info.visible) invisibles.add(info.desc);
  }

  const inalcanzables = atrapado
    ? []
    : await page.evaluate(([alcanzados, nombres]) => {
        const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]';
        return Array.from(document.querySelectorAll<HTMLElement>(sel))
          .filter((el) => {
            if (alcanzados.includes(el.dataset.a11yId ?? "")) return false;
            if (el.matches(":disabled")) return false;
            // MenuCuenta y el buscador del header cambian su control por otro
            // igual al recibir foco: si ya se alcanzó uno con ese nombre, es él.
            const nombre = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
            if (nombre && nombres.includes(nombre)) return false;
            // tabindex=-1 a propósito: pestañas inactivas y menús (se llega con flechas).
            if (el.getAttribute("tabindex") === "-1") return false;
            if (el.closest("[inert], [aria-hidden=true]")) return false;
            if (el.closest("details:not([open])") && el.tagName !== "SUMMARY") return false;
            // Los radios de un grupo comparten una sola parada de Tab.
            if (el instanceof HTMLInputElement && el.type === "radio") return false;
            const r = el.getBoundingClientRect();
            const s = getComputedStyle(el);
            return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
          })
          .slice(0, 10)
          .map((el) => `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""} "${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 50)}"`);
      }, [vistos, [...nombresVistos]] as const);

  return { invisibles: [...invisibles], atrapado, inalcanzables, paradas: vistos.length, fin };
}

async function visitar(page: Page, rol: Rol, ruta: string, v: Variante) {
  const variante = `${v.tema}-${v.ancho}`;
  const anotar = (h: Omit<Hallazgo, "rol" | "ruta" | "variante">) => hallazgos.push({ rol, ruta, variante, ...h });
  try {
    await page.goto(ruta, { waitUntil: "load", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});

    const axe = await correrAxe(page);
    for (const vi of axe.violaciones) {
      anotar({ tipo: "axe", regla: vi.id, impacto: vi.impact, detalle: `${vi.help} (${vi.total} nodos)`, nodos: vi.nodos });
    }
    for (const vi of axe.revisar) {
      anotar({ tipo: "revisar", regla: vi.id, detalle: `${vi.help} (${vi.total} nodos)`, nodos: vi.nodos });
    }

    if (v.teclado) {
      const t = await recorrerConTeclado(page);
      if (t.invisibles.length) anotar({ tipo: "foco-invisible", detalle: `${t.invisibles.length} de ${t.paradas} paradas`, nodos: t.invisibles });
      if (t.atrapado) anotar({ tipo: "atrapado", detalle: t.atrapado });
      if (t.inalcanzables.length) anotar({ tipo: "inalcanzable", detalle: `${t.inalcanzables.length} controles; ${t.paradas} paradas, ${t.fin}`, nodos: t.inalcanzables });
    }
  } catch (err) {
    anotar({ tipo: "timeout", detalle: (err as Error).message.split("\n")[0].slice(0, 300) });
  }
}

function guardar() {
  mkdirSync("test-results/a11y", { recursive: true });
  writeFileSync("test-results/a11y/hallazgos.json", JSON.stringify(hallazgos, null, 2));
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  for (const rol of ["estudiante", "admin"] as const) {
    const user = await crearUsuarioConfirmado(admin, { email: emails[rol], password, nombre: `E2E A11y ${rol}` });
    ids[rol] = user.id;
  }
  await promoverAAdministrador(admin, ids.admin!);

  const { data: plan, error: errPlan } = await admin.from("planes").select("id").limit(1).single();
  if (errPlan || !plan) throw new Error(`No hay plan para otorgar acceso de prueba: ${errPlan?.message}`);
  const { error: errSuscripcion } = await admin.from("suscripciones").insert({
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
  if (errSuscripcion) throw new Error(`No pude crear la suscripción de prueba: ${errSuscripcion.message}`);

  for (const rol of ["estudiante", "admin"] as const) sesiones[rol] = await iniciarSesion(browser, emails[rol]);

  // Staging no tiene las lecciones exactas de CURSO_FIXTURE ni videos listos:
  // basta el curso semilla con una lección introductoria y una con acceso.
  const { data: curso, error: errCurso } = await admin
    .from("cursos")
    .select("slug, modulos(lecciones(slug, orden, es_introductoria))")
    .eq("id", CURSO_FIXTURE.id)
    .single();
  if (errCurso || !curso) throw new Error(`No encontré el curso semilla: ${errCurso?.message}`);
  const cursoSlug = curso.slug as string;
  const lecciones = curso.modulos.flatMap((m) => m.lecciones);
  const introductoria = lecciones.find((l) => l.es_introductoria)!.slug;
  const conAcceso = lecciones.find((l) => !l.es_introductoria)!.slug;
  const { data: post } = await admin.from("comunidad_posts").select("slug").eq("eliminado", false).limit(1).maybeSingle();
  const { data: perfil } = await admin.from("perfiles").select("slug").eq("id", ids.estudiante!).single();
  const { data: certificado } = await admin.from("certificados").select("codigo_verificacion").limit(1).maybeSingle();
  const cat = CURSO_FIXTURE.categoriaSlug;

  rutas.anonimo = [
    "/",
    "/catalogo",
    `/catalogo/${cat}`,
    `/cursos/${cursoSlug}`,
    `/cursos/${cursoSlug}/${introductoria}`,
    "/login",
    "/registro",
    "/recuperar",
    "/canjear",
    "/soporte",
    "/verificar-correo",
    "/actualizar-password",
    "/cuenta-eliminada",
    "/verificar-certificado",
    ...(certificado ? [`/verificar-certificado/${certificado.codigo_verificacion}`] : []),
    "/ruta-que-no-existe",
  ];
  rutas.estudiante = [
    "/dashboard",
    "/dashboard/catalogo",
    `/dashboard/catalogo/${cat}`,
    "/dashboard/progreso",
    "/dashboard/certificados",
    "/dashboard/notas",
    "/dashboard/comunidad",
    ...(post ? [`/dashboard/comunidad/${post.slug}`] : []),
    "/dashboard/perfil",
    "/dashboard/suscripcion",
    "/dashboard/soporte",
    `/cursos/${cursoSlug}/${conAcceso}`,
    `/cursos/${cursoSlug}/examen`,
    "/acceso-denegado",
  ];
  rutas.admin = [
    "/admin",
    "/admin/bitacora",
    "/admin/categorias",
    "/admin/codigos",
    "/admin/comunidad",
    "/admin/configuracion",
    "/admin/cupones",
    "/admin/cursos",
    "/admin/cursos/nuevo",
    `/admin/cursos/${cursoSlug}`,
    "/admin/planes",
    "/admin/usuarios",
    `/admin/usuarios/${perfil!.slug}`,
  ];
});

test.afterAll(async () => {
  test.setTimeout(5 * 60_000);
  for (const rol of ["estudiante", "admin"] as const) {
    if (ids[rol]) await limpiarDatosDeUsuario(admin, ids[rol]!);
    await borrarUsuarioPorEmail(admin, emails[rol]);
  }
});

for (const rol of ROLES) {
  test(`barrido de accesibilidad como ${rol}`, async ({ browser }) => {
    test.setTimeout(60 * 60_000);
    for (const v of VARIANTES) {
      const context = await browser.newContext({
        storageState: rol === "anonimo" ? undefined : sesiones[rol],
        viewport: { width: v.ancho, height: 900 },
      });
      await context.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [TEMA_STORAGE_KEY, v.tema] as const);
      const page = await context.newPage();
      for (const ruta of rutas[rol]) await visitar(page, rol, ruta, v);
      await context.close();
      guardar();
    }
  });
}

// Igual que capa1: los recorridos solo recolectan y el veredicto va al final.
test("accesibilidad sin problemas críticos ni serios", async () => {
  guardar();
  const conteo = new Map<string, number>();
  for (const h of hallazgos) {
    const clave = h.tipo === "axe" ? `axe ${h.impacto} ${h.regla}` : h.tipo === "revisar" ? `revisar ${h.regla}` : h.tipo;
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  console.log(`\nAccesibilidad — ${hallazgos.length} hallazgos`);
  for (const [clave, n] of [...conteo].sort()) console.log(`  ${clave}: ${n}`);
  console.log("Detalle: test-results/a11y/hallazgos.json\n");

  const graves = hallazgos.filter(
    (h) => h.tipo === "axe" ? h.impacto === "critical" || h.impacto === "serious" : h.tipo !== "revisar",
  );
  expect(graves, graves.map((h) => `  [${h.rol}] [${h.variante}] ${h.ruta} — ${h.regla ?? h.tipo}: ${h.detalle}`).join("\n")).toEqual([]);
});
