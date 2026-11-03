import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Fase 7 del plan de blindaje: cada uso de la llave maestra (service_role)
 * se salta RLS, así que un error de autorización en cualquiera de esos
 * archivos es una puerta abierta. La regla: quien importa `createAdminClient`
 * escribe justo encima, en una línea que empieza con `// Llave maestra:`,
 * por qué no le basta la sesión del usuario. Esta prueba falla si un archivo
 * nuevo la importa sin decirlo, para que la decisión se tome a conciencia y
 * quede a la vista en la revisión del PR.
 */

const RAIZ = join(process.cwd(), "src");
const IMPORTACION = 'import { createAdminClient } from "@/lib/supabase/admin";';

function archivosDeCodigo(carpeta: string): string[] {
  return readdirSync(carpeta, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = join(carpeta, entrada.name);
    if (entrada.isDirectory()) return archivosDeCodigo(ruta);
    return /\.tsx?$/.test(entrada.name) && !/\.test\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

const usosDeLaLlave = archivosDeCodigo(RAIZ)
  .map((ruta) => ({ ruta: relative(process.cwd(), ruta).replaceAll("\\", "/"), lineas: readFileSync(ruta, "utf8").split(/\r?\n/) }))
  .filter(({ lineas }) => lineas.some((linea) => linea.includes('from "@/lib/supabase/admin"')));

describe("usos de la llave maestra (service_role)", () => {
  it("hay usos que revisar (si esto falla, cambió la forma de importar y la prueba no ve nada)", () => {
    expect(usosDeLaLlave.length).toBeGreaterThan(10);
  });

  it.each(usosDeLaLlave.map(({ ruta, lineas }) => [ruta, lineas] as const))(
    "%s explica por qué la necesita, en la línea de arriba del import",
    (_ruta, lineas) => {
      const indice = lineas.findIndex((linea) => linea.trim() === IMPORTACION);

      expect(indice, "importa la llave de otra forma: usa exactamente el import de siempre").toBeGreaterThan(0);
      expect(lineas[indice - 1]).toMatch(/^\/\/ Llave maestra: .{20,}/);
    },
  );
});
