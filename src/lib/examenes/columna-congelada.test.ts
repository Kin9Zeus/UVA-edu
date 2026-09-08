import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * P0-1 (AUDIT-2026-09-08.md): `intentos_examen.preguntas_congeladas` guarda el
 * examen resuelto — `respuestasAceptadas` y cuál opción es la correcta.
 *
 * RLS de Postgres autoriza FILAS, no COLUMNAS. La policy
 * `intentos_examen_select_propio_o_admin` (067) le da al estudiante su propia
 * fila entera, así que hasta el script 070 esa columna era legible por su
 * dueño con una sola petición a PostgREST:
 *
 *   curl ".../rest/v1/intentos_examen?select=preguntas_congeladas" \
 *     -H "apikey: <NEXT_PUBLIC_SUPABASE_ANON_KEY>" \
 *     -H "Authorization: Bearer <access_token de su cookie>"
 *
 * La `anon key` viaja en el bundle del navegador y el JWT está en la cookie:
 * los dos valores los tiene el propio estudiante. Que
 * `prepararPreguntasParaEstudiante()` limpie lo que la app manda al navegador
 * no cambiaba nada, porque el atacante no pasa por la app.
 *
 * El arreglo real es el `GRANT` por columna de
 * `supabase/sql/070_intentos_examen_grants_por_columna.sql`. Estas pruebas son
 * la red que impide que se deshaga sin querer, y cubren los dos lados:
 *
 *   1. que ningún archivo nuevo lea la columna con el cliente de sesión —
 *      hacerlo ya no filtra nada, pero rompería la pantalla en producción con
 *      un 42501 que en desarrollo no se ve si la base local no tiene el 070;
 *   2. que la lista de columnas del `GRANT` no vuelva a incluirla.
 *
 * Son estructurales a propósito: la prueba de verdad (que PostgREST responda
 * 42501) vive en `scripts/rls-test.ts` y necesita una base real, así que no
 * puede correr en CI de unitarias ni bloquear un merge por sí sola.
 */

const COLUMNA = "preguntas_congeladas";

/**
 * Archivos autorizados a leer la columna. Todos deben hacerlo con el cliente
 * de Service Role, que es el único que conserva el privilegio, y todos
 * verifican la identidad a mano (`intento.id_usuario !== usuarioId`) porque al
 * saltarse RLS ya no hay nadie más que lo haga.
 */
const LECTORES_AUTORIZADOS = new Set([
  // getIntentoEnCurso y getResultadoIntento: las dos pantallas del estudiante.
  "src/lib/examen.ts",
  // enviarIntento: califica en el servidor sobre las respuestas congeladas.
  "src/actions/examenes/intento.ts",
  // getRevisionIntento: la revisión del panel. requireAdmin() ya verificó el
  // rol, pero devuelve el cliente de SESIÓN — y un administrador también es
  // `authenticated`, así que aquí tampoco sirve.
  "src/actions/admin/examenes.ts",
]);

/**
 * Sin esto la prueba se caza a sí misma: varios archivos nombran la columna en
 * sus comentarios justamente para explicar por qué NO la leen. Lo que se
 * revisa es el código, no lo que se escribe sobre él. Mismo criterio que
 * `site-url.test.ts`.
 */
function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

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

function rutaRelativa(ruta: string): string {
  return relative(process.cwd(), ruta).split("\\").join("/");
}

/**
 * Captura `<cliente>.from("intentos_examen")....select(<proyección>)`.
 * El grupo 1 es la expresión del cliente, el 3 la proyección — con eso se
 * distingue una lectura de la columna de una que no la pide.
 *
 * `createAdminClient\(\)` va primero en la alternancia: como identificador
 * suelto también encajaría, y entonces el `()` quedaría fuera de la captura.
 */
const PATRON_LECTURA =
  /(createAdminClient\(\)|[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\.from\(\s*["'`]intentos_examen["'`]\s*\)([\s\S]{0,800}?)\.select\(([\s\S]{0,800}?)\)/g;

/**
 * Un cliente vale si es `createAdminClient()` en línea —la forma que ya usa
 * el resto del proyecto— o una variable que en ESE archivo solo se asigna
 * desde `createAdminClient()`.
 *
 * La segunda condición es la que importa: `admin` significa el cliente de
 * Service Role en `examenes/intento.ts` y el resultado de `requireAdmin()`
 * (cliente de sesión) en `admin/examenes.ts`. Sin comprobar de dónde sale la
 * asignación en cada archivo, el mismo nombre daría verde en los dos sitios.
 */
function esClienteDeServicio(cliente: string, fuente: string): boolean {
  if (cliente === "createAdminClient()") return true;
  // Una expresión con punto (`admin.supabase`) nunca es el cliente de
  // servicio: es un campo de otra cosa.
  if (cliente.includes(".")) return false;

  const asignaciones = [...fuente.matchAll(new RegExp(`const\\s+${cliente}\\s*=`, "g"))].length;
  const desdeAdmin = [
    ...fuente.matchAll(new RegExp(`const\\s+${cliente}\\s*=\\s*createAdminClient\\(\\)`, "g")),
  ].length;

  return asignaciones > 0 && asignaciones === desdeAdmin;
}

describe("preguntas_congeladas no se lee con el cliente de sesión (P0-1)", () => {
  const raiz = join(process.cwd(), "src");
  const tocanLaColumna = archivosFuente(raiz)
    .filter((ruta) => sinComentarios(readFileSync(ruta, "utf8")).includes(COLUMNA))
    .map(rutaRelativa);

  it("solo los lectores autorizados nombran la columna en código", () => {
    const inesperados = tocanLaColumna.filter((ruta) => !LECTORES_AUTORIZADOS.has(ruta));

    expect(inesperados).toEqual([]);
  });

  it("cada lectura de la columna usa el cliente de Service Role", () => {
    // No basta con que el archivo IMPORTE createAdminClient: `admin/examenes.ts`
    // lo importa para otras funciones y aun así leía la columna con
    // `admin.supabase`, que es el cliente de SESIÓN que devuelve requireAdmin()
    // — y un administrador también es `authenticated`, así que el 070 lo
    // bloquea igual. Por eso se mira qué cliente hace CADA lectura, no qué
    // importa el archivo.
    const infractores = tocanLaColumna.flatMap((ruta) => {
      const fuente = sinComentarios(readFileSync(join(process.cwd(), ruta), "utf8"));

      return [...fuente.matchAll(PATRON_LECTURA)]
        .filter((lectura) => lectura[3].includes(COLUMNA))
        .map((lectura) => lectura[1])
        .filter((cliente) => !esClienteDeServicio(cliente, fuente))
        .map((cliente) => `${ruta} lee con \`${cliente}\``);
    });

    expect(infractores).toEqual([]);
  });

  it("la lista de LECTORES_AUTORIZADOS no tiene entradas muertas", () => {
    // Una entrada que ya no lee la columna es permiso concedido a nada, y con
    // el tiempo hace que la lista deje de significar algo.
    const muertas = [...LECTORES_AUTORIZADOS].filter((ruta) => !tocanLaColumna.includes(ruta));

    expect(muertas).toEqual([]);
  });
});

describe("el GRANT por columna del 070 excluye la columna sensible", () => {
  const sql = readFileSync(
    join(process.cwd(), "supabase/sql/070_intentos_examen_grants_por_columna.sql"),
    "utf8",
  );
  const sqlSinComentarios = sql.replace(/^\s*--.*$/gm, "");

  it("revoca el SELECT amplio sobre la tabla", () => {
    expect(sqlSinComentarios).toMatch(
      /revoke\s+select\s+on\s+(table\s+)?public\.intentos_examen\s+from/i,
    );
  });

  it("vuelve a conceder SELECT solo sobre una lista explícita de columnas", () => {
    expect(sqlSinComentarios).toMatch(
      /grant\s+select\s*\([^)]+\)\s*\n?\s*on\s+public\.intentos_examen\s+to/i,
    );
  });

  it("preguntas_congeladas no aparece en ninguna lista de GRANT", () => {
    const listasConcedidas = [...sqlSinComentarios.matchAll(/grant\s+select\s*\(([^)]+)\)/gi)].map(
      (coincidencia) => coincidencia[1],
    );

    expect(listasConcedidas.length).toBeGreaterThan(0);
    expect(listasConcedidas.filter((lista) => lista.includes(COLUMNA))).toEqual([]);
  });
});
