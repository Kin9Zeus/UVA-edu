import { readFileSync } from "node:fs";
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
 * número está escrito dos veces.
 *
 * Si se separan, el panel reporta como vencido a alguien que sigue entrando
 * —o al revés— y nada más lo detectaría: son dos ficheros que nadie edita
 * junto. Este test lee el SQL y compara.
 */
describe("la ventana de gracia no se separa entre TypeScript y SQL", () => {
  it("el interval de la vista de métricas coincide con DURACION_GRACIA_DIAS", () => {
    const sql = readFileSync(
      join(process.cwd(), "supabase/sql/036_vistas_metricas_panel.sql"),
      "utf8",
    );

    // La línea exacta que suma la ventana de gracia a la fecha de renovación.
    const coincidencias = [
      ...sql.matchAll(/fecha_renovacion at time zone 'UTC'\)\s*\+\s*interval '(\d+) days'/g),
    ];

    expect(
      coincidencias.length,
      "no se encontró el interval de gracia en 036_vistas_metricas_panel.sql; ¿se renombró la vista o la columna?",
    ).toBe(1);

    expect(Number(coincidencias[0][1])).toBe(DURACION_GRACIA_DIAS);
  });
});
