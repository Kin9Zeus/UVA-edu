import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { resumirActividadComunidad, type Mensaje } from "./comunidad-actividad";
import { diasEntre } from "./comunidadReportes";

// Martes 27 de octubre de 2026, 10:00 en Bogotá. La semana actual empieza el 26.
const AHORA = new Date("2026-10-27T15:00:00Z");

function mensaje(idUsuario: string, creadoEn: string, categoria: Mensaje["categoria"] = "PREGUNTAS"): Mensaje {
  return { idUsuario, categoria, creadoEn };
}

describe("resumirActividadComunidad", () => {
  it("sin datos: 12 semanas vacías y todo en cero", () => {
    const r = resumirActividadComunidad([], [], AHORA);
    expect(r.semanas).toHaveLength(12);
    expect(r.semanas.at(-1)!.inicio).toBe("2026-10-26");
    expect(r.semanas.every((s) => s.total === 0)).toBe(true);
    expect([r.publicaciones30, r.respuestas30, r.personas30]).toEqual([0, 0, 0]);
  });

  it("separa publicaciones y respuestas por semana y suma ambas por categoría", () => {
    const r = resumirActividadComunidad(
      [mensaje("ana", "2026-10-26T14:00:00Z", "EMPLEO")],
      [mensaje("ana", "2026-10-27T14:00:00Z", "EMPLEO"), mensaje("luis", "2026-10-27T14:00:00Z")],
      AHORA,
    );
    const actual = r.semanas.at(-1)!;
    expect(actual.porSerie).toEqual({ publicaciones: 1, respuestas: 2 });
    expect(actual.total).toBe(3);
    expect(actual.porCategoria).toMatchObject({ EMPLEO: 2, PREGUNTAS: 1, ANUNCIOS: 0 });
  });

  it("las cifras van en 30 días y cuentan personas distintas; la gráfica, en 12 semanas", () => {
    const r = resumirActividadComunidad(
      [mensaje("ana", "2026-10-01T15:00:00Z"), mensaje("ana", "2026-09-20T15:00:00Z")],
      [mensaje("ana", "2026-10-20T15:00:00Z"), mensaje("luis", "2026-10-20T15:00:00Z")],
      AHORA,
    );
    expect([r.publicaciones30, r.respuestas30, r.personas30]).toEqual([1, 2, 2]);
    expect(r.semanas.reduce((a, s) => a + s.total, 0)).toBe(4);
  });

  it("el día lo pone Colombia: el lunes a las 2 a. m. UTC todavía es domingo", () => {
    const r = resumirActividadComunidad([mensaje("ana", "2026-10-26T02:00:00Z")], [], AHORA);
    expect(r.semanas.at(-1)!.total).toBe(0);
    expect(r.semanas.at(-2)!.total).toBe(1);
  });
});

describe("diasEntre", () => {
  it("cuenta días de calendario en Colombia, no bloques de 24 horas", () => {
    expect(diasEntre("2026-10-27T13:00:00Z", AHORA)).toBe(0);
    // 26 de octubre a las 11 p. m. en Bogotá: ayer, aunque fueron 11 horas.
    expect(diasEntre("2026-10-27T04:00:00Z", AHORA)).toBe(1);
    expect(diasEntre("2026-10-24T15:00:00Z", AHORA)).toBe(3);
  });
});
