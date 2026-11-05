import { join } from "node:path";
import type { Page } from "@playwright/test";

/**
 * Herramientas de accesibilidad compartidas por el barrido (a11y-barrido,
 * bajo pedido) y la prueba contra retrocesos (retroceso-accesibilidad, en CI):
 * axe-core sobre la página y un recorrido con Tab que detecta foco invisible,
 * trampas de teclado y controles que Tab nunca alcanza.
 */

const AXE_PATH = join(process.cwd(), "node_modules/axe-core/axe.min.js");

export async function correrAxe(page: Page) {
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
export async function recorrerConTeclado(page: Page) {
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
