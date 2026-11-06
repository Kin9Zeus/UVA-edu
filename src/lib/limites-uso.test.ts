import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ACCIONES_LIMITADAS } from "@/lib/limites-uso";

/**
 * Los nombres de acción viven en dos lugares: aquí (TypeScript) y en
 * `private.limite_de_accion` (SQL). Si alguien agrega una acción solo en la
 * app, la base responde "Acción sin límite definido" y la acción queda
 * bloqueada para todos; si la agrega solo en la base, nunca se usa. Esta
 * prueba lee la versión más reciente de la función en supabase/sql/.
 */
function accionesEnSql(): string[] {
  const carpeta = join(process.cwd(), "supabase", "sql");
  const archivos = readdirSync(carpeta)
    .filter((nombre) => /^\d{3}_.*\.sql$/.test(nombre))
    .sort();
  const ultimo = archivos
    .map((nombre) => readFileSync(join(carpeta, nombre), "utf8"))
    .filter((sql) => sql.includes("function private.limite_de_accion"))
    .at(-1);
  if (!ultimo) throw new Error("No se encontró private.limite_de_accion en supabase/sql/");

  const cuerpo = ultimo.slice(ultimo.indexOf("function private.limite_de_accion"));
  const valores = cuerpo.slice(cuerpo.indexOf("from (values"), cuerpo.indexOf(") as l(accion"));
  return [...valores.matchAll(/\(\s*'([a-z_]+)'\s*,/g)].map((m) => m[1]);
}

describe("acciones con límite de uso", () => {
  it("la app y la base tienen exactamente las mismas", () => {
    expect([...accionesEnSql()].sort()).toEqual([...ACCIONES_LIMITADAS].sort());
  });
});
