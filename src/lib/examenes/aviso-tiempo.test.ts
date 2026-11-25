import { describe, expect, it } from "vitest";
import { avisoDeTiempo } from "@/lib/examenes/aviso-tiempo";

describe("avisoDeTiempo", () => {
  it("anuncia solo al cruzar 5 min, 1 min y 10 s", () => {
    expect(avisoDeTiempo(301)).toBe("");
    expect(avisoDeTiempo(300)).toBe("Quedan 5 minutos.");
    expect(avisoDeTiempo(60)).toBe("Queda 1 minuto.");
    expect(avisoDeTiempo(10)).toBe("Quedan 10 segundos.");
    expect(avisoDeTiempo(0)).toBe("Quedan 10 segundos.");
  });

  it("entre umbrales el texto no cambia, así el lector no vuelve a hablar", () => {
    const textos = new Set(Array.from({ length: 3600 }, (_, s) => avisoDeTiempo(s)));
    expect(textos.size).toBe(4);
    expect(new Set([59, 30, 11].map(avisoDeTiempo)).size).toBe(1);
  });
});
