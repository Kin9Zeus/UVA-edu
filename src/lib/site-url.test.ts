import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { siteUrl } from "@/lib/site-url";

const ENTORNO_ORIGINAL = { ...process.env };

afterEach(() => {
  process.env = { ...ENTORNO_ORIGINAL };
});

describe("siteUrl", () => {
  it("devuelve NEXT_PUBLIC_SITE_URL cuando está definida", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://uva.co";
    expect(siteUrl()).toBe("https://uva.co");
  });

  it("quita la barra final para que las URLs no queden con doble barra", () => {
    // "https://uva.co//auth/confirm" no es la misma entrada que
    // "https://uva.co/auth/confirm" para la lista de Redirect URLs de Supabase.
    process.env.NEXT_PUBLIC_SITE_URL = "https://uva.co/";
    expect(siteUrl()).toBe("https://uva.co");
    process.env.NEXT_PUBLIC_SITE_URL = "https://uva.co///";
    expect(siteUrl()).toBe("https://uva.co");
  });

  it("ignora una variable vacía o en blanco", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "   ";
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("cae a localhost fuera de producción", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(siteUrl()).toBe("http://localhost:3000");
  });

  it("lanza en producción si falta la variable, en vez de inventar un origen", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    // NODE_ENV es de solo lectura en los tipos de Node; en tiempo de
    // ejecución es una propiedad normal del objeto.
    Object.defineProperty(process.env, "NODE_ENV", { value: "production", configurable: true });
    expect(() => siteUrl()).toThrow(/NEXT_PUBLIC_SITE_URL/);
  });
});

/**
 * Prueba de regresión de P1-1 (AUDIT-2026-09-04.md).
 *
 * El fallo no fue un archivo mal escrito: fue la MISMA función `getOrigin()`
 * copiada literalmente en siete archivos, de la que seis acababan en un enlace
 * enviado por correo o impreso en un PDF. Mockear cada Server Action para
 * comprobar su `redirectTo` cubriría los seis de hoy y ninguno de los que se
 * escriban mañana; lo que impide que el patrón vuelva es prohibirlo.
 *
 * Si esta prueba falla, la respuesta correcta casi siempre es usar `siteUrl()`.
 * Si de verdad hace falta el host de la petición (un `cors_origin`, un
 * `Vary`), añadir el archivo a EXCEPCIONES con el comentario que explique por
 * qué — igual que `src/actions/admin/mux.ts`.
 */
const EXCEPCIONES = new Set([
  // Único uso legítimo: `cors_origin` del Direct Upload de Mux tiene que ser
  // el origen real del navegador que sube, no una constante de despliegue.
  // Ver el comentario extenso en ese archivo.
  "src/actions/admin/mux.ts",
]);

function archivosFuente(dir: string, acumulado: string[] = []): string[] {
  for (const entrada of readdirSync(dir)) {
    if (entrada === "generated" || entrada === "node_modules") continue;
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      archivosFuente(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

/**
 * Sin esto la prueba se caza a sí misma: `site-url.ts` cita el patrón
 * prohibido dentro de su propio comentario para explicar qué se corrigió, y
 * otros archivos lo mencionan al documentar por qué NO lo usan. Lo que se
 * revisa es el código, no lo que se escribe sobre él.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("nadie arma una URL con el header Host (P1-1)", () => {
  it("solo las excepciones documentadas leen headers().get('host')", () => {
    const raiz = join(process.cwd(), "src");
    const culpables = archivosFuente(raiz)
      .filter((ruta) => /\.get\(\s*["'`]host["'`]\s*\)/i.test(sinComentarios(readFileSync(ruta, "utf8"))))
      .map((ruta) => relative(process.cwd(), ruta).split("\\").join("/"))
      .filter((ruta) => !EXCEPCIONES.has(ruta));

    expect(culpables).toEqual([]);
  });
});
