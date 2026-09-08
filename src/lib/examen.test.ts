import { describe, expect, it } from "vitest";
import { calcularDisponibilidad } from "@/lib/examen";

const ahora = Date.now();
const minutosAtras = (min: number) => new Date(ahora - min * 60_000).toISOString();
const horasAtras = (h: number) => new Date(ahora - h * 60 * 60_000).toISOString();

describe("calcularDisponibilidad", () => {
  it("sin intentos previos, siempre disponible", () => {
    expect(calcularDisponibilidad([], 3)).toEqual({ disponible: true });
  });

  it("el primer intento fallido de la ronda espera el cooldown corto (15 min)", () => {
    const resultado = calcularDisponibilidad([{ finalizadoEn: minutosAtras(5) }], 3);
    expect(resultado.disponible).toBe(false);
    if (!resultado.disponible) expect(resultado.esperaLarga).toBe(false);
  });

  it("pasado el cooldown corto, vuelve a estar disponible", () => {
    expect(calcularDisponibilidad([{ finalizadoEn: minutosAtras(16) }], 3)).toEqual({ disponible: true });
  });

  it("el segundo intento fallido (2 de 3) sigue con cooldown corto, no largo", () => {
    const resultado = calcularDisponibilidad(
      [{ finalizadoEn: minutosAtras(5) }, { finalizadoEn: minutosAtras(20) }],
      3,
    );
    expect(resultado.disponible).toBe(false);
    if (!resultado.disponible) expect(resultado.esperaLarga).toBe(false);
  });

  it("al agotar la ronda completa (3 de 3), el cooldown pasa a ser el largo (5h)", () => {
    const resultado = calcularDisponibilidad(
      [{ finalizadoEn: minutosAtras(5) }, { finalizadoEn: minutosAtras(20) }, { finalizadoEn: minutosAtras(40) }],
      3,
    );
    expect(resultado.disponible).toBe(false);
    if (!resultado.disponible) expect(resultado.esperaLarga).toBe(true);
  });

  it("dentro de la espera larga (menos de 5h desde que agotó), sigue bloqueado", () => {
    const resultado = calcularDisponibilidad(
      [{ finalizadoEn: horasAtras(4) }, { finalizadoEn: horasAtras(4.5) }, { finalizadoEn: horasAtras(5.1) }],
      3,
    );
    expect(resultado.disponible).toBe(false);
    if (!resultado.disponible) expect(resultado.esperaLarga).toBe(true);
  });

  it("pasadas las 5 horas de agotar la ronda, vuelve a estar disponible (ronda nueva, sin admin)", () => {
    const resultado = calcularDisponibilidad(
      [{ finalizadoEn: horasAtras(5.5) }, { finalizadoEn: horasAtras(6) }, { finalizadoEn: horasAtras(6.5) }],
      3,
    );
    expect(resultado).toEqual({ disponible: true });
  });

  it("una ronda que se agota por segunda vez (6 de 3) vuelve a exigir la espera larga", () => {
    const seisIntentos = Array.from({ length: 6 }, (_, i) => ({ finalizadoEn: minutosAtras(5 + i * 20) }));
    const resultado = calcularDisponibilidad(seisIntentos, 3);
    expect(resultado.disponible).toBe(false);
    if (!resultado.disponible) expect(resultado.esperaLarga).toBe(true);
  });

  it("sin límite de intentos (null), nunca hay ronda que agotar: siempre cooldown corto", () => {
    const muchosIntentos = Array.from({ length: 9 }, (_, i) => ({ finalizadoEn: minutosAtras(5 + i * 20) }));
    const resultado = calcularDisponibilidad(muchosIntentos, null);
    expect(resultado.disponible).toBe(false);
    if (!resultado.disponible) expect(resultado.esperaLarga).toBe(false);
  });

  it("el último intento sin finalizar (finalizadoEn null) no debería llegar acá, pero no revienta", () => {
    expect(calcularDisponibilidad([{ finalizadoEn: null }], 3)).toEqual({ disponible: true });
  });
});
