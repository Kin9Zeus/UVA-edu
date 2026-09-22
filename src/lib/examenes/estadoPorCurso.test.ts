import { describe, expect, it } from "vitest";
import { estadoDeCurso, porcentajeLecciones, porcentajeMostrado } from "@/lib/examenes/estadoPorCurso";

describe("estadoDeCurso", () => {
  it("sin examen, el 100% de clases completa el curso (comportamiento previo a Revf5)", () => {
    expect(estadoDeCurso(100, undefined)).toBe("COMPLETADO");
  });

  it("sin examen, por debajo del 100% sigue en progreso", () => {
    expect(estadoDeCurso(99, undefined)).toBe("EN_PROGRESO");
    expect(estadoDeCurso(0, undefined)).toBe("EN_PROGRESO");
  });

  it("con examen exigido y sin aprobar, el 100% de clases NO completa el curso", () => {
    expect(estadoDeCurso(100, { requerido: true, aprobado: false })).toBe("EXAMEN_PENDIENTE");
  });

  it("con examen exigido y aprobado, el curso está completo", () => {
    expect(estadoDeCurso(100, { requerido: true, aprobado: true })).toBe("COMPLETADO");
  });

  it("aprobar el examen antes de terminar las clases YA completa el curso (Revf6)", () => {
    expect(estadoDeCurso(80, { requerido: true, aprobado: true })).toBe("COMPLETADO");
    expect(estadoDeCurso(0, { requerido: true, aprobado: true })).toBe("COMPLETADO");
  });

  it("un examen despublicado (requerido=false) no bloquea, aunque no esté aprobado", () => {
    expect(estadoDeCurso(100, { requerido: false, aprobado: false })).toBe("COMPLETADO");
  });
});

describe("porcentajeMostrado", () => {
  it("sin examen, muestra el porcentaje de lecciones tal cual", () => {
    expect(porcentajeMostrado(40, undefined)).toBe(40);
    expect(porcentajeMostrado(40, { requerido: false, aprobado: false })).toBe(40);
  });

  it("con examen exigido y aprobado, muestra 100% aunque falten clases", () => {
    expect(porcentajeMostrado(40, { requerido: true, aprobado: true })).toBe(100);
    expect(porcentajeMostrado(0, { requerido: true, aprobado: true })).toBe(100);
  });

  it("con examen exigido y sin aprobar, muestra el porcentaje real de lecciones", () => {
    expect(porcentajeMostrado(80, { requerido: true, aprobado: false })).toBe(80);
  });
});

describe("porcentajeLecciones", () => {
  it("redondea hacia abajo: el 100 solo sale con todas las clases vistas", () => {
    // Con Math.round, 199/200 daba 100 y el curso sin examen salía COMPLETADO.
    expect(porcentajeLecciones(199, 200)).toBe(99);
    expect(estadoDeCurso(porcentajeLecciones(199, 200), undefined)).toBe("EN_PROGRESO");
    expect(porcentajeLecciones(200, 200)).toBe(100);
    expect(porcentajeLecciones(2, 3)).toBe(66);
  });

  it("sin lecciones es 0, no NaN", () => {
    expect(porcentajeLecciones(0, 0)).toBe(0);
  });
});

/**
 * P2-4 (AUDIT-2026-09-22.md): la tabla completa de la regla, con conteos
 * reales de clases. Es la que ahora comparten el catálogo del dashboard,
 * "Mi progreso", "Sigue aprendiendo" y el panel de admin.
 */
describe("regla de curso completado (P2-4)", () => {
  it.each([
    // [completadas, total, examen, esperado]
    [6, 10, undefined, "EN_PROGRESO"],
    [10, 10, undefined, "COMPLETADO"],
    [6, 10, { requerido: true, aprobado: false }, "EN_PROGRESO"],
    [10, 10, { requerido: true, aprobado: false }, "EXAMEN_PENDIENTE"],
    [6, 10, { requerido: true, aprobado: true }, "COMPLETADO"],
    [10, 10, { requerido: true, aprobado: true }, "COMPLETADO"],
  ] as const)("%i/%i clases, examen %o → %s", (completadas, total, examen, esperado) => {
    expect(estadoDeCurso(porcentajeLecciones(completadas, total), examen)).toBe(esperado);
  });
});
