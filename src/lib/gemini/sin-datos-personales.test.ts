import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A la IA nunca le llegan datos personales ni contenido de la Comunidad
 * (plan de blindaje, agregado de las fases 3-6). Hoy Gemini recibe solo lo
 * del curso: títulos, contenido y resúmenes de clases, módulos y
 * transcripciones de los videos (docs/ops/inventario-de-datos.md, sección 2).
 *
 * La prueba lee el código de los módulos que arman lo que va a Gemini y
 * falla si alguno consulta una tabla fuera de esta lista. Para agregar una:
 * comprobar primero que no trae datos de una persona, y actualizar el
 * inventario de datos.
 */
const TABLAS_PERMITIDAS = new Set([
  "cursos",
  "lecciones",
  "transcripciones_video",
  // Lo que la generación de exámenes escribe y lee de vuelta: preguntas y su estado.
  "examenes",
  "preguntas_examen",
  "trabajos_generacion_examen",
]);

const CARPETAS = ["src/lib/gemini", "src/lib/examenes/generacion", "src/lib/descripciones-ia"];

function archivosDe(carpeta: string): string[] {
  return readdirSync(join(process.cwd(), carpeta))
    .filter((nombre) => nombre.endsWith(".ts") && !nombre.endsWith(".test.ts"))
    .map((nombre) => join(carpeta, nombre));
}

describe("lo que llega a Gemini", () => {
  const archivos = CARPETAS.flatMap(archivosDe);

  it("solo los archivos de estas carpetas usan el cliente de Gemini", () => {
    const fuera: string[] = [];
    const recorrer = (carpeta: string) => {
      for (const entrada of readdirSync(join(process.cwd(), carpeta), { withFileTypes: true })) {
        const ruta = join(carpeta, entrada.name);
        if (entrada.isDirectory()) recorrer(ruta);
        else if (/\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name)) {
          const codigo = readFileSync(join(process.cwd(), ruta), "utf8");
          const enCarpeta = CARPETAS.some((c) => ruta.replaceAll("\\", "/").startsWith(c));
          if (!enCarpeta && /from "@\/lib\/gemini\/client"/.test(codigo)) fuera.push(ruta);
        }
      }
    };
    recorrer("src");
    recorrer("scripts");
    // Si alguien llama a Gemini desde otro lado, esta prueba tiene que mirar ese archivo también.
    expect(fuera).toEqual([]);
  });

  it.each(CARPETAS.flatMap(archivosDe))("%s no consulta tablas con datos de personas", (archivo) => {
    const codigo = readFileSync(join(process.cwd(), archivo), "utf8");
    const tablas = [...codigo.matchAll(/\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g)].map((m) => m[1]);
    expect(tablas.filter((tabla) => !TABLAS_PERMITIDAS.has(tabla))).toEqual([]);
    // Tampoco por RPC: ninguna de estas carpetas llama funciones de la base.
    expect(codigo).not.toMatch(/\.rpc\(/);
  });

  it("revisa los archivos que de verdad arman la petición", () => {
    expect(archivos.map((a) => a.replaceAll("\\", "/"))).toEqual(
      expect.arrayContaining(["src/lib/examenes/generacion/generar.ts", "src/lib/descripciones-ia/generar.ts"]),
    );
  });
});
