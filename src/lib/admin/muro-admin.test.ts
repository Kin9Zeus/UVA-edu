import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P2-1 (AUDIT-2026-09-08): el muro de rol del panel de administración.
 *
 * Qué se protege
 * --------------
 * Que un usuario autenticado SIN rol `ADMINISTRADOR` no pueda renderizar
 * `/admin`. Las mutaciones tienen otras dos capas detrás —`requireAdmin()`
 * en las 51 Server Actions y RLS con `private.es_administrador()`—, pero
 * ninguna de las dos impide pintar la pantalla: sin esta puerta, un
 * estudiante logueado leería la bitácora administrativa, el listado de
 * usuarios y las métricas del negocio.
 *
 * Por qué hace falta una prueba y no basta el código
 * --------------------------------------------------
 * Esa puerta vivió en dos sitios a la vez y cada uno documentaba al otro
 * como "la capa que de verdad lo hace":
 *
 *   · `src/lib/supabase/proxy.ts` consultaba el rol y redirigía;
 *   · `src/app/(admin)/admin/layout.tsx` hacía lo mismo y su comentario lo
 *     llamaba "defensa en profundidad".
 *
 * Al cerrar P2-8 (AUDIT-2026-09-04) se quitó el chequeo del middleware —una
 * consulta repetida por request— dejando el layout como única puerta. Pero
 * el comentario del layout siguió diciendo que el middleware bloqueaba, así
 * que quien lo leyera podía quitarlo por "redundante" y abrir el panel
 * entero sin que nada fallara: ni un tipo, ni un test, ni un lint.
 *
 * El comentario ya está corregido. Esta prueba existe para que la
 * protección no dependa de que alguien lo lea.
 *
 * Es estructural porque la prueba de comportamiento —entrar a `/admin` con
 * una sesión de estudiante y aterrizar en `/acceso-denegado`— es de
 * Playwright, y el job `e2e` se sacó de CI el 2026-09-08 (4 de sus 11
 * pruebas fallaban). Mientras siga fuera, esto es lo único que bloquea un
 * merge.
 */

const LAYOUT_ADMIN = "src/app/(admin)/admin/layout.tsx";
const GUARDIA = "src/lib/admin/guardiaPagina.ts";
const CARPETA_ADMIN = "src/app/(admin)/admin";

/**
 * Lo que se revisa es el código, no lo que se escribe sobre él: el propio
 * layout cita en un comentario la afirmación falsa que se corrigió, y el
 * middleware explica por qué YA NO consulta el rol. Sin esto, ambos
 * archivos parecerían tener la guardia por mencionarla. Mismo criterio que
 * `site-url.test.ts`.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function leer(ruta: string): string {
  return sinComentarios(readFileSync(join(process.cwd(), ruta), "utf8"));
}

describe("el panel de administración tiene una puerta de rol (P2-1)", () => {
  const guardia = leer(GUARDIA);
  const layout = leer(LAYOUT_ADMIN);

  it("la guardia compara el rol contra ADMINISTRADOR y manda a acceso denegado", () => {
    expect(guardia).toMatch(/rol\s*!==\s*"ADMINISTRADOR"/);
    expect(guardia).toMatch(/redirect\("\/acceso-denegado"\)/);
  });

  it("el layout la usa (pinta nombre y foto del administrador)", () => {
    expect(layout).toMatch(/await exigirAdministradorEnPagina\(/);
  });
});

/**
 * Fase 6 del plan de blindaje: el layout solo no alcanza. Next no lo vuelve a
 * ejecutar al navegar entre páginas que lo comparten, y no impide que la
 * página corra ni que su contenido viaje en la respuesta
 * (node_modules/next/dist/docs/01-app/02-guides/authentication.md, "Layouts
 * and auth checks"). Cada página llama a la guardia por su cuenta.
 */
describe("cada página de /admin comprueba el rol por su cuenta (fase 6)", () => {
  function paginas(carpeta: string): string[] {
    return readdirSync(join(process.cwd(), carpeta), { withFileTypes: true }).flatMap((entrada) => {
      const ruta = `${carpeta}/${entrada.name}`;
      if (entrada.isDirectory()) return paginas(ruta);
      return entrada.name === "page.tsx" ? [ruta] : [];
    });
  }

  const todas = paginas(CARPETA_ADMIN);

  it("encuentra las páginas del panel", () => {
    expect(todas.length).toBeGreaterThanOrEqual(13);
  });

  it.each(todas)("%s llama a exigirAdministradorEnPagina antes de leer datos", (pagina) => {
    const fuente = leer(pagina);
    expect(fuente).toMatch(/await exigirAdministradorEnPagina\(/);
    // Antes de cualquier otra espera: si lee primero, el dato ya salió.
    const cuerpo = fuente.slice(fuente.indexOf("export default async function"));
    const primerAwait = cuerpo.match(/await\s+([A-Za-z_]+)/);
    expect(primerAwait?.[1]).toBe("exigirAdministradorEnPagina");
  });
});

describe("el panel de administración exige el segundo factor (fase 8.1)", () => {
  const guardia = leer(GUARDIA);

  /**
   * Estructural por la misma razón que la prueba de arriba: el recorrido real
   * es de Playwright y está fuera de CI. Lo que se fija es que la guardia
   * compruebe el nivel de sesión y mande a la pantalla del código, y que lo
   * haga DESPUÉS del rol (un estudiante debe ver "acceso denegado", no que
   * active el 2FA).
   */
  it("la guardia comprueba aal2 y redirige a la pantalla del segundo factor", () => {
    expect(guardia).toMatch(/getNivelAalActual\(\)\)\s*!==\s*"aal2"/);
    expect(guardia).toMatch(/rutaSegundoFactor\(/);
  });

  it("la comprobación del segundo factor va después de la del rol", () => {
    const rol = guardia.indexOf("acceso-denegado");
    const aal = guardia.indexOf("getNivelAalActual()");

    expect(rol).toBeGreaterThan(-1);
    expect(aal).toBeGreaterThan(rol);
  });
});
