import { readFileSync } from "node:fs";
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
const MIDDLEWARE = "src/lib/supabase/proxy.ts";

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
  const layout = leer(LAYOUT_ADMIN);
  const middleware = leer(MIDDLEWARE);

  /** Compara el rol contra ADMINISTRADOR y corta el paso con un redirect. */
  const guarda = (fuente: string) =>
    /ADMINISTRADOR/.test(fuente) && /redirect\(/.test(fuente);

  const guardaElLayout = guarda(layout);
  const guardaElMiddleware = guarda(middleware);

  it("alguna capa verifica el rol antes de renderizar /admin", () => {
    expect({
      [LAYOUT_ADMIN]: guardaElLayout,
      [MIDDLEWARE]: guardaElMiddleware,
      hayPuerta: guardaElLayout || guardaElMiddleware,
    }).toMatchObject({ hayPuerta: true });
  });

  it("si el middleware no verifica el rol, el layout es obligatorio", () => {
    // Formulada así —y no como "el layout debe tener el chequeo"— para que
    // mover la guardia de vuelta al middleware sea un cambio legítimo que
    // no rompe la prueba. Lo que no se puede es quitarla de los dos.
    if (guardaElMiddleware) return;

    expect(guardaElLayout).toBe(true);
    expect(layout).toMatch(/acceso-denegado/);
  });
});
