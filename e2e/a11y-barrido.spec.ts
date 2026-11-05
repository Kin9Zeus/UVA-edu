import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { correrAxe, recorrerConTeclado } from "./a11y-herramientas";
import { borrarUsuarios, prepararUsuariosYRutas, rutas, sesiones, TODOS_LOS_ROLES, type Rol } from "./a11y-comun";
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
 *   A11Y=1 npx playwright test e2e/a11y-barrido.spec.ts
 *
 * Informe en test-results/a11y/hallazgos.json.
 */

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

const hallazgos: Hallazgo[] = [];
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
// Solo bajo pedido (A11Y=1): tardan ~20 min y no son parte de `npm run test:e2e`
// de cada tarea; se usan en barridos de accesibilidad.
test.skip(!process.env.A11Y, "Barrido de accesibilidad: correr con A11Y=1");

test.beforeAll(async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  await prepararUsuariosYRutas(browser);
});

test.afterAll(async () => {
  test.setTimeout(5 * 60_000);
  await borrarUsuarios();
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
