import { describe, expect, it } from "vitest";
import { estadoDeCurso } from "@/lib/examenes/estadoPorCurso";

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

  it("aprobar el examen antes de terminar las clases no adelanta el estado", () => {
    expect(estadoDeCurso(80, { requerido: true, aprobado: true })).toBe("EN_PROGRESO");
  });

  it("un examen despublicado (requerido=false) no bloquea, aunque no esté aprobado", () => {
    expect(estadoDeCurso(100, { requerido: false, aprobado: false })).toBe("COMPLETADO");
  });
});
