/**
 * Contraste WCAG 2.2 de los tokens de color de globals.css, en los dos temas.
 *
 * Lo usan dos cosas:
 *   - contraste.test.ts: falla la suite si un par obligatorio baja de su
 *     mínimo (4,5:1 texto, 3:1 bordes de controles e indicadores).
 *   - scripts/audit/contraste.ts: escribe la tabla en docs/contrastes.md.
 *
 * Los pares salen de cómo se usan los tokens en la app: cada token de texto
 * sobre cada fondo donde puede caer, cada relleno con su texto encima y los
 * bordes de controles. Los colores con transparencia se mezclan con el fondo
 * de abajo antes de medir, como los ve el ojo.
 */

export type Tema = "claro" | "oscuro";
export type Tokens = Record<string, string>;
type Rgba = [number, number, number, number];

export type TipoPar = "texto" | "relleno" | "control" | "insignia";

export interface Par {
  tipo: TipoPar;
  /** Token del color de adelante (texto, borde o ícono), sin el `--`. */
  frente: string;
  /** Token del fondo inmediato, sin el `--`. */
  fondo: string;
  /** Si el fondo es transparente, el token sobre el que se apoya. */
  base?: string;
  minimo: number;
}

export interface Medicion extends Par {
  tema: Tema;
  ratio: number;
  pasa: boolean;
}

/** Tokens de texto: deben pasar 4,5:1 sobre todos los fondos de abajo. */
export const TOKENS_TEXTO = [
  "uva-text",
  "uva-text-muted",
  "uva-text-faint",
  "uva-muted",
  "uva-muted-2",
  "uva-accent-ink",
  "uva-accent-text",
  "uva-link-hover",
  "uva-accent-2-text",
  "uva-danger-text",
  "uva-error-text",
  "uva-warning-text",
  "uva-valid",
  "uva-success-text",
] as const;

/** Fondos donde cae texto: página, tarjeta, superficie secundaria y fila con
 *  el puntero encima. */
export const FONDOS_TEXTO = ["uva-bg", "uva-surface", "uva-surface-2", "uva-hover"] as const;

/** Exentos por WCAG: deshabilitados y separadores decorativos. Se listan en
 *  la tabla para que se vea que fue a propósito. */
export const TOKENS_EXENTOS = ["uva-dim", "uva-text-disabled", "uva-divider"] as const;

export const PARES: Par[] = [
  ...TOKENS_TEXTO.flatMap((frente) =>
    FONDOS_TEXTO.map((fondo): Par => ({ tipo: "texto", frente, fondo, minimo: 4.5 })),
  ),
  // Texto sobre rellenos de color.
  { tipo: "relleno", frente: "uva-on-accent", fondo: "uva-btn", minimo: 4.5 },
  { tipo: "relleno", frente: "uva-on-accent", fondo: "uva-btn-hover", minimo: 4.5 },
  { tipo: "relleno", frente: "uva-on-accent", fondo: "uva-btn-active", minimo: 4.5 },
  { tipo: "relleno", frente: "uva-on-bright", fondo: "uva-accent", minimo: 4.5 },
  { tipo: "relleno", frente: "uva-on-bright", fondo: "uva-accent-2", minimo: 4.5 },
  { tipo: "relleno", frente: "uva-on-bright", fondo: "uva-whatsapp", minimo: 4.5 },
  { tipo: "relleno", frente: "uva-bg", fondo: "uva-valid", minimo: 4.5 },
  // Insignias del panel admin: fondo translúcido sobre la tarjeta.
  ...["success", "warn", "danger", "neutral"].map(
    (n): Par => ({
      tipo: "insignia",
      frente: `uva-badge-${n}-fg`,
      fondo: `uva-badge-${n}-bg`,
      base: "uva-surface",
      minimo: 4.5,
    }),
  ),
  // Bordes de campos y el magenta de foco y progreso: 3:1 (WCAG 1.4.11).
  { tipo: "control", frente: "uva-line-strong", fondo: "uva-surface", minimo: 3 },
  { tipo: "control", frente: "uva-line-strong", fondo: "uva-bg", minimo: 3 },
  { tipo: "control", frente: "uva-accent", fondo: "uva-surface", minimo: 3 },
  { tipo: "control", frente: "uva-accent", fondo: "uva-bg", minimo: 3 },
];

/** Lee los tokens `--uva-*` de un bloque `selector { ... }` de globals.css. */
function leerBloque(css: string, selector: string): Tokens {
  const inicio = css.search(new RegExp(`^${selector.replace(".", "\\.")} \\{`, "m"));
  if (inicio === -1) throw new Error(`globals.css no tiene el bloque ${selector}`);
  const fin = css.indexOf("\n}", inicio);
  const tokens: Tokens = {};
  // Sin comentarios: uno que mencione "--uva-x: #valor" se leería como token.
  const cuerpo = css.slice(inicio, fin).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of cuerpo.matchAll(/--(uva-[\w-]+):\s*([^;]+);/g)) {
    tokens[m[1]] = m[2].trim();
  }
  return tokens;
}

/** Tokens de cada tema. El oscuro hereda de `:root` lo que no redefine. */
export function leerTemas(css: string): Record<Tema, Tokens> {
  const claro = leerBloque(css, ":root");
  return { claro, oscuro: { ...claro, ...leerBloque(css, ".dark") } };
}

function resolver(tokens: Tokens, nombre: string, vistos: string[] = []): string {
  const valor = tokens[nombre];
  if (valor === undefined) throw new Error(`Falta el token --${nombre}`);
  const ref = valor.match(/^var\(--(uva-[\w-]+)\)$/);
  if (!ref) return valor;
  if (vistos.includes(ref[1])) throw new Error(`Referencia circular en --${nombre}`);
  return resolver(tokens, ref[1], [...vistos, nombre]);
}

export function aRgba(valor: string): Rgba {
  const hex = valor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join("") : hex[1];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const rgb = valor.match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const [r, g, b, a = 1] = rgb[1].split(",").map((p) => Number(p.trim()));
    return [r, g, b, a];
  }
  throw new Error(`Color que el cálculo de contraste no entiende: ${valor}`);
}

/** Mezcla un color (con o sin transparencia) sobre un fondo opaco. */
function sobre(frente: Rgba, fondo: Rgba): Rgba {
  const a = frente[3];
  return [0, 1, 2].map((i) => frente[i] * a + fondo[i] * (1 - a)).concat(1) as Rgba;
}

function luminancia([r, g, b]: Rgba): number {
  const canal = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

/** Razón de contraste WCAG entre dos colores opacos. */
export function razon(a: Rgba, b: Rgba): number {
  const [claro, oscuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x);
  return (claro + 0.05) / (oscuro + 0.05);
}

export function medir(tokens: Tokens, tema: Tema, par: Par): Medicion {
  let fondo = aRgba(resolver(tokens, par.fondo));
  if (fondo[3] < 1) {
    // Un fondo translúcido se apoya en otro; sin base explícita, la página.
    fondo = sobre(fondo, aRgba(resolver(tokens, par.base ?? "uva-bg")));
  }
  const frente = sobre(aRgba(resolver(tokens, par.frente)), fondo);
  const ratio = razon(frente, fondo);
  return { ...par, tema, ratio, pasa: ratio >= par.minimo };
}

export function medirTodo(css: string): Medicion[] {
  const temas = leerTemas(css);
  return (Object.keys(temas) as Tema[]).flatMap((tema) => PARES.map((par) => medir(temas[tema], tema, par)));
}
