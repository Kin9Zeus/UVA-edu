import { mkdirSync, writeFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { borrarUsuarios, prepararUsuariosYRutas, rutas, sesiones, TODOS_LOS_ROLES, type Rol } from "./a11y-comun";
import { TEMA_STORAGE_KEY } from "../src/lib/tema";

/**
 * Baja visión: cada pantalla, con el rol que la ve, en tres condiciones.
 *
 *   zoom-200     zoom del navegador al 200 % en una ventana de 1280×900,
 *                que es una ventana de 640×450 px CSS (WCAG 1.4.10, reflujo).
 *   letra-150    letra del sistema al 150 % en celular (375 px) y
 *   letra-200    al 200 % en tablet (768 px). Todo está en `rem` (tamaños,
 *                espacios y puntos de quiebre), así que la letra al 200 %
 *                a 375 px equivale a una pantalla de ~187 px: no es una meta
 *                razonable y en celular se mide al 150 %.
 *   espaciado    WCAG 1.4.12: interlineado 1,5, letras 0,12 em, palabras
 *                0,16 em y párrafos 2 em, a 375 y 1280 px.
 *
 * Por cada visita se anota:
 *   - scroll-horizontal  la página es más ancha que la ventana
 *   - se-sale            un elemento termina fuera de la ventana (aunque un
 *                        overflow-x: hidden esconda el scroll)
 *   - cortado            un texto no cabe en su caja y queda oculto sin aviso
 *   - recortado          igual, pero con "…" (truncate, line-clamp): recorte
 *                        a propósito; se anota para revisarlo y no reprueba
 *   - fijo-tapa          lo fijo/pegajoso ocupa más del 40 % del alto
 *
 * Deja una captura de la ventana por pantalla y condición en
 * test-results/baja-vision/<condicion>/ (las de página completa pierden el
 * ajuste de letra). Como el barrido, contra un build y solo bajo pedido:
 *
 *   npm run build && npm run start      (en otra terminal)
 *   A11Y=1 npx playwright test e2e/a11y-baja-vision.spec.ts
 *
 * Informe en test-results/baja-vision/hallazgos.json.
 */

const ROLES = process.env.A11Y_ROLES
  ? TODOS_LOS_ROLES.filter((r) => process.env.A11Y_ROLES!.split(",").includes(r))
  : TODOS_LOS_ROLES;

type Condicion = { nombre: string; ancho: number; alto: number; letraPx?: number; espaciado?: boolean };
const CONDICIONES: Condicion[] = [
  { nombre: "zoom-200", ancho: 640, alto: 450 },
  { nombre: "letra-150", ancho: 375, alto: 812, letraPx: 24 },
  { nombre: "letra-200", ancho: 768, alto: 1024, letraPx: 32 },
  { nombre: "espaciado-375", ancho: 375, alto: 812, espaciado: true },
  { nombre: "espaciado-1280", ancho: 1280, alto: 900, espaciado: true },
];
const SOLO = process.env.BAJA_VISION_CONDICIONES?.split(",");

const CSS_ESPACIADO = `
  * { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; }
  p { margin-bottom: 2em !important; }
`;

type TipoHallazgo = "scroll-horizontal" | "se-sale" | "cortado" | "recortado" | "fijo-tapa" | "letra-no-aplica" | "timeout";
interface Hallazgo {
  rol: Rol;
  ruta: string;
  condicion: string;
  tipo: TipoHallazgo;
  detalle: string;
  nodos?: string[];
}
const hallazgos: Hallazgo[] = [];

/** Corre en la página: Playwright serializa solo esta función. */
function medir() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  function describir(el: Element) {
    const partes: string[] = [];
    for (let n: Element | null = el; n && n !== document.body && partes.length < 3; n = n.parentElement) {
      const clases = Array.from(n.classList).slice(0, 3).join(".");
      partes.unshift(n.tagName.toLowerCase() + (n.id ? `#${n.id}` : "") + (clases ? `.${clases}` : ""));
    }
    const texto = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
    return `${partes.join(" > ")}${texto ? ` "${texto}"` : ""}`;
  }
  const visible = (el: Element) => {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 1 && r.height > 1;
  };
  // Lo que ya se desplaza a propósito (filas de pestañas, tablas con scroll).
  const enScrollPropio = (el: Element) => {
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const ox = getComputedStyle(n).overflowX;
      if (ox === "auto" || ox === "scroll") return true;
    }
    return false;
  };
  const tieneTextoPropio = (el: Element) =>
    Array.from(el.childNodes).some((c) => c.nodeType === Node.TEXT_NODE && c.textContent!.trim());

  const seSale: string[] = [];
  const cortado: string[] = [];
  const recortado: string[] = [];
  let altoFijo = 0;
  const fijos: string[] = [];

  for (const el of Array.from(document.body.querySelectorAll("*"))) {
    if (!visible(el) || el.closest("[aria-hidden=true], .sr-only")) continue;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);

    if (r.right > vw + 1 && !enScrollPropio(el)) seSale.push(`${describir(el)} (+${Math.round(r.right - vw)} px)`);

    if (tieneTextoPropio(el) && el.tagName !== "TEXTAREA" && el.tagName !== "INPUT") {
      const ocultaX = s.overflowX !== "visible" && el.scrollWidth > el.clientWidth + 1;
      const ocultaY = s.overflowY !== "visible" && el.scrollHeight > el.clientHeight + 1;
      if ((ocultaX && s.overflowX !== "auto" && s.overflowX !== "scroll") || (ocultaY && s.overflowY !== "auto" && s.overflowY !== "scroll")) {
        const conAviso = s.textOverflow === "ellipsis" || s.webkitLineClamp !== "none";
        (conAviso ? recortado : cortado).push(describir(el));
      }
    }

    if ((s.position === "fixed" || s.position === "sticky") && r.top < vh && r.bottom > 0 && r.width >= vw * 0.5) {
      // Los diálogos y paneles abiertos tapan a propósito; aquí no hay ninguno abierto.
      altoFijo += Math.min(r.bottom, vh) - Math.max(r.top, 0);
      fijos.push(`${describir(el)} (${Math.round(r.height)} px)`);
    }
  }

  return {
    scrollWidth: document.documentElement.scrollWidth,
    vw,
    vh,
    letraRaiz: parseFloat(getComputedStyle(document.documentElement).fontSize),
    seSale: seSale.slice(0, 8),
    cortado: cortado.slice(0, 12),
    recortado: recortado.slice(0, 12),
    fijoPct: Math.round((altoFijo / vh) * 100),
    fijos,
  };
}

async function visitar(page: Page, rol: Rol, ruta: string, c: Condicion) {
  const anotar = (h: Omit<Hallazgo, "rol" | "ruta" | "condicion">) => hallazgos.push({ rol, ruta, condicion: c.nombre, ...h });
  try {
    await page.goto(ruta, { waitUntil: "load", timeout: 60_000 });
    await page.waitForLoadState("networkidle", { timeout: 8_000 }).catch(() => {});
    if (c.espaciado) await page.addStyleTag({ content: CSS_ESPACIADO });

    const m = await page.evaluate(medir);
    if (c.letraPx && Math.round(m.letraRaiz) !== c.letraPx) {
      anotar({ tipo: "letra-no-aplica", detalle: `la raíz mide ${m.letraRaiz} px, no ${c.letraPx}` });
    }
    if (m.scrollWidth > m.vw) anotar({ tipo: "scroll-horizontal", detalle: `${m.scrollWidth} px en una ventana de ${m.vw}` });
    if (m.seSale.length) anotar({ tipo: "se-sale", detalle: `${m.seSale.length} elemento(s)`, nodos: m.seSale });
    if (m.cortado.length) anotar({ tipo: "cortado", detalle: `${m.cortado.length} texto(s)`, nodos: m.cortado });
    if (m.recortado.length) anotar({ tipo: "recortado", detalle: `${m.recortado.length} texto(s)`, nodos: m.recortado });
    if (m.fijoPct > 40) anotar({ tipo: "fijo-tapa", detalle: `${m.fijoPct} % del alto`, nodos: m.fijos });

    const archivo = `${rol}${ruta === "/" ? "-portada" : ruta.replace(/\//g, "-")}.png`;
    await page.screenshot({ path: `test-results/baja-vision/${c.nombre}/${archivo}` });
  } catch (err) {
    anotar({ tipo: "timeout", detalle: (err as Error).message.split("\n")[0].slice(0, 300) });
  }
}

function guardar() {
  mkdirSync("test-results/baja-vision", { recursive: true });
  writeFileSync("test-results/baja-vision/hallazgos.json", JSON.stringify(hallazgos, null, 2));
}

test.describe.configure({ mode: "serial" });
test.skip(!process.env.A11Y, "Barrido de baja visión: correr con A11Y=1");

test.beforeAll(async ({ browser }) => {
  test.setTimeout(10 * 60_000);
  await prepararUsuariosYRutas(browser);
});

test.afterAll(async () => {
  test.setTimeout(5 * 60_000);
  await borrarUsuarios();
});

for (const rol of ROLES) {
  test(`baja visión como ${rol}`, async ({ browser }) => {
    test.setTimeout(60 * 60_000);
    for (const c of CONDICIONES.filter((c) => !SOLO || SOLO.includes(c.nombre))) {
      // isMobile: false a propósito: con true el navegador agranda la ventana
      // para que quepa lo que desborda y el scroll horizontal nunca aparece.
      const context = await browser.newContext({
        storageState: rol === "anonimo" ? undefined : sesiones[rol],
        viewport: { width: c.ancho, height: c.alto },
        isMobile: false,
      });
      await context.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [TEMA_STORAGE_KEY, "oscuro"] as const);
      const page = await context.newPage();
      if (c.letraPx) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Page.setFontSizes", { fontSizes: { standard: c.letraPx } });
      }
      for (const ruta of rutas[rol]) await visitar(page, rol, ruta, c);
      await context.close();
      guardar();
    }
  });
}

test("baja visión sin desbordes ni textos cortados", async () => {
  guardar();
  const conteo = new Map<string, number>();
  for (const h of hallazgos) conteo.set(`${h.condicion} ${h.tipo}`, (conteo.get(`${h.condicion} ${h.tipo}`) ?? 0) + 1);
  console.log(`\nBaja visión — ${hallazgos.length} hallazgos`);
  for (const [clave, n] of [...conteo].sort()) console.log(`  ${clave}: ${n}`);
  console.log("Detalle: test-results/baja-vision/hallazgos.json\n");
  expect(hallazgos.filter((h) => h.tipo !== "recortado").map((h) => `  [${h.rol}] [${h.condicion}] ${h.ruta} — ${h.tipo}: ${h.detalle}`)).toEqual([]);
});
