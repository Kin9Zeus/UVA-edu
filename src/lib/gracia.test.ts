import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { calcularDiasGracia, DURACION_GRACIA_DIAS } from "@/lib/gracia";

describe("calcularDiasGracia", () => {
  it("recién vencida: quedan los 5 días completos", () => {
    const ahora = new Date("2026-03-10T00:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(5);
  });

  it("a mitad de la ventana: redondea hacia arriba", () => {
    const ahora = new Date("2026-03-12T12:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(3);
  });

  it("justo en el límite: 0, no negativo", () => {
    const ahora = new Date("2026-03-15T00:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(0);
  });

  it("ya pasada la ventana: se queda en 0, nunca negativo", () => {
    const ahora = new Date("2026-04-01T00:00:00Z");
    expect(calcularDiasGracia("2026-03-10T00:00:00Z", ahora)).toBe(0);
  });
});

/**
 * La ventana de gracia decide dos cosas en dos lenguajes distintos: si el
 * estudiante entra al contenido (TypeScript) y si el panel lo cuenta como
 * "acceso vigente" (SQL). Postgres no puede importar la constante, así que el
 * número está escrito varias veces: la vista de métricas (036), la función de
 * vigencia y el canje (038).
 *
 * Si se separan, el panel reporta como vencido a alguien que sigue entrando
 * —o al revés— y nada más lo detectaría: son ficheros que nadie edita junto.
 * Este test barre todo `supabase/sql/` y compara cada aparición.
 */
describe("la ventana de gracia no se separa entre TypeScript y SQL", () => {
  it("todos los interval de gracia del SQL coinciden con DURACION_GRACIA_DIAS", () => {
    const directorio = join(process.cwd(), "supabase/sql");
    // La línea exacta que suma la ventana de gracia a la fecha de renovación.
    const patron = /fecha_renovacion at time zone 'UTC'\)\s*\+\s*interval '(\d+) days'/g;

    const encontrados = readdirSync(directorio)
      .filter((nombre) => nombre.endsWith(".sql"))
      .flatMap((nombre) =>
        [...readFileSync(join(directorio, nombre), "utf8").matchAll(patron)].map((m) => ({
          archivo: nombre,
          dias: Number(m[1]),
        })),
      );

    expect(
      encontrados.length,
      "no se encontró ningún interval de gracia en supabase/sql/; ¿se renombró la vista o la columna?",
    ).toBeGreaterThan(0);

    for (const { archivo, dias } of encontrados) {
      expect(dias, `${archivo} usa otra ventana de gracia`).toBe(DURACION_GRACIA_DIAS);
    }
  });
});
