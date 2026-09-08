import { describe, expect, it } from "vitest";
import {
  barajar,
  calificarIntento,
  calificarPregunta,
  normalizarRespuestaCorta,
} from "@/lib/examenes/calificar";
import {
  prepararPreguntasParaEstudiante,
  type PreguntaCongelada,
} from "@/lib/examenes/tipos";

const enunciado = { type: "doc" as const, content: [] };

function opciones(...marcas: boolean[]) {
  return marcas.map((correcta, i) => ({ id: `o${i + 1}`, texto: `Opción ${i + 1}`, correcta }));
}

function pregunta(parcial: Partial<PreguntaCongelada>): PreguntaCongelada {
  return {
    id: "p1",
    tipo: "OPCION_UNICA",
    enunciado,
    puntos: 1,
    opciones: opciones(true, false, false),
    respuestasAceptadas: [],
    ...parcial,
  };
}

describe("normalizarRespuestaCorta", () => {
  it("ignora mayúsculas, tildes, espacios y signos", () => {
    expect(normalizarRespuestaCorta("V-Ray")).toBe(normalizarRespuestaCorta("vray"));
    expect(normalizarRespuestaCorta("  Iluminación Global ")).toBe(
      normalizarRespuestaCorta("iluminacion global"),
    );
    expect(normalizarRespuestaCorta("3ds Max")).toBe(normalizarRespuestaCorta("3dsmax"));
  });

  it("una respuesta de solo espacios o signos queda vacía", () => {
    expect(normalizarRespuestaCorta("   ")).toBe("");
    expect(normalizarRespuestaCorta("¿?-.")).toBe("");
  });

  it("no confunde respuestas realmente distintas", () => {
    expect(normalizarRespuestaCorta("radiosidad")).not.toBe(normalizarRespuestaCorta("raytracing"));
  });
});

describe("calificarPregunta — OPCION_UNICA / VERDADERO_FALSO", () => {
  it("acierta con la opción correcta", () => {
    expect(calificarPregunta(pregunta({}), "o1")).toBe(true);
  });

  it("falla con otra opción", () => {
    expect(calificarPregunta(pregunta({}), "o2")).toBe(false);
  });

  it("una pregunta sin responder cuenta como fallada", () => {
    expect(calificarPregunta(pregunta({}), undefined)).toBe(false);
  });

  it("no se aprueba marcando además la correcta y otra", () => {
    expect(calificarPregunta(pregunta({}), ["o1", "o2"])).toBe(false);
  });

  it("verdadero/falso funciona igual: una sola correcta", () => {
    const vf = pregunta({
      tipo: "VERDADERO_FALSO",
      opciones: [
        { id: "v", texto: "Verdadero", correcta: false },
        { id: "f", texto: "Falso", correcta: true },
      ],
    });
    expect(calificarPregunta(vf, "f")).toBe(true);
    expect(calificarPregunta(vf, "v")).toBe(false);
  });
});

describe("calificarPregunta — OPCION_MULTIPLE (todo o nada)", () => {
  const multiple = pregunta({ tipo: "OPCION_MULTIPLE", opciones: opciones(true, true, false, false) });

  it("acierta solo con el conjunto exacto, sin importar el orden", () => {
    expect(calificarPregunta(multiple, ["o1", "o2"])).toBe(true);
    expect(calificarPregunta(multiple, ["o2", "o1"])).toBe(true);
  });

  it("falla si le falta una correcta", () => {
    expect(calificarPregunta(multiple, ["o1"])).toBe(false);
  });

  it("falla si agrega una incorrecta", () => {
    expect(calificarPregunta(multiple, ["o1", "o2", "o3"])).toBe(false);
  });

  it("marcar todas las opciones no aprueba", () => {
    expect(calificarPregunta(multiple, ["o1", "o2", "o3", "o4"])).toBe(false);
  });

  it("los ids repetidos no inflan el conjunto", () => {
    expect(calificarPregunta(multiple, ["o1", "o1", "o2"])).toBe(true);
  });
});

describe("calificarPregunta — RELLENAR_ESPACIO", () => {
  const corta = pregunta({
    tipo: "RELLENAR_ESPACIO",
    opciones: null,
    respuestasAceptadas: ["V-Ray", "Chaos V-Ray"],
  });

  it("acepta cualquiera de las variantes, normalizando", () => {
    expect(calificarPregunta(corta, "vray")).toBe(true);
    expect(calificarPregunta(corta, "  CHAOS  V-RAY ")).toBe(true);
  });

  it("rechaza otra respuesta", () => {
    expect(calificarPregunta(corta, "corona")).toBe(false);
  });

  it("una respuesta vacía o de solo signos no acierta", () => {
    expect(calificarPregunta(corta, "")).toBe(false);
    expect(calificarPregunta(corta, "  ")).toBe(false);
    expect(calificarPregunta(corta, undefined)).toBe(false);
  });

  it("un array no cuenta como respuesta de texto", () => {
    expect(calificarPregunta(corta, ["vray"])).toBe(false);
  });
});

describe("calificarPregunta — casos degenerados", () => {
  it("una pregunta sin ninguna opción correcta nunca se da por acertada", () => {
    const rota = pregunta({ opciones: opciones(false, false) });
    expect(calificarPregunta(rota, "o1")).toBe(false);
    expect(calificarPregunta(rota, [])).toBe(false);
    expect(calificarPregunta(rota, undefined)).toBe(false);
  });
});

describe("calificarIntento", () => {
  const preguntas: PreguntaCongelada[] = [
    pregunta({ id: "a", puntos: 1 }),
    pregunta({ id: "b", puntos: 1 }),
    pregunta({ id: "c", puntos: 1 }),
    pregunta({ id: "d", puntos: 1 }),
  ];

  it("aprueba justo en el umbral (3 de 4 = 75%)", () => {
    const resultado = calificarIntento(preguntas, { a: "o1", b: "o1", c: "o1", d: "o2" }, 75);
    expect(resultado.puntajePct).toBe(75);
    expect(resultado.aprobado).toBe(true);
    expect(resultado.preguntasFalladas).toEqual(["d"]);
  });

  it("reprueba justo por debajo (2 de 4 = 50%)", () => {
    const resultado = calificarIntento(preguntas, { a: "o1", b: "o1" }, 75);
    expect(resultado.puntajePct).toBe(50);
    expect(resultado.aprobado).toBe(false);
    expect(resultado.preguntasFalladas).toEqual(["c", "d"]);
  });

  it("pondera por puntos, no por número de preguntas", () => {
    const ponderadas: PreguntaCongelada[] = [
      pregunta({ id: "a", puntos: 9 }),
      pregunta({ id: "b", puntos: 1 }),
    ];
    // Acierta solo la pesada: 9 de 10 = 90%, aprueba aunque falló la mitad
    // de las preguntas.
    const resultado = calificarIntento(ponderadas, { a: "o1" }, 75);
    expect(resultado.puntosObtenidos).toBe(9);
    expect(resultado.puntosPosibles).toBe(10);
    expect(resultado.puntajePct).toBe(90);
    expect(resultado.aprobado).toBe(true);
  });

  it("respeta una nota requerida más alta que el mínimo", () => {
    const resultado = calificarIntento(preguntas, { a: "o1", b: "o1", c: "o1", d: "o2" }, 90);
    expect(resultado.puntajePct).toBe(75);
    expect(resultado.aprobado).toBe(false);
  });

  it("redondea a dos decimales (2 de 3 = 66,67%)", () => {
    const tres = preguntas.slice(0, 3);
    const resultado = calificarIntento(tres, { a: "o1", b: "o1" }, 75);
    expect(resultado.puntajePct).toBe(66.67);
  });

  it("un intento sin respuestas da 0 y no aprueba", () => {
    const resultado = calificarIntento(preguntas, {}, 75);
    expect(resultado.puntajePct).toBe(0);
    expect(resultado.aprobado).toBe(false);
    expect(resultado.preguntasFalladas).toHaveLength(4);
  });

  it("un examen sin preguntas no se aprueba por división vacía", () => {
    const resultado = calificarIntento([], {}, 75);
    expect(resultado.puntajePct).toBe(0);
    expect(resultado.aprobado).toBe(false);
  });

  it("ignora respuestas de preguntas que no están en el intento congelado", () => {
    const resultado = calificarIntento(preguntas, { a: "o1", b: "o1", c: "o1", d: "o1", zzz: "o1" }, 75);
    expect(resultado.puntajePct).toBe(100);
    expect(resultado.puntosPosibles).toBe(4);
  });
});

describe("prepararPreguntasParaEstudiante", () => {
  it("no deja salir cuál opción es la correcta", () => {
    const publicas = prepararPreguntasParaEstudiante([
      pregunta({ tipo: "OPCION_MULTIPLE", opciones: opciones(true, false) }),
    ]);

    const serializado = JSON.stringify(publicas);
    expect(serializado).not.toContain("correcta");
    expect(publicas[0].opciones).toEqual([
      { id: "o1", texto: "Opción 1" },
      { id: "o2", texto: "Opción 2" },
    ]);
  });

  it("no deja salir las respuestas aceptadas de una pregunta corta", () => {
    const publicas = prepararPreguntasParaEstudiante([
      pregunta({ tipo: "RELLENAR_ESPACIO", opciones: null, respuestasAceptadas: ["vray"] }),
    ]);

    expect(JSON.stringify(publicas)).not.toContain("vray");
    expect(publicas[0].opciones).toBeNull();
  });
});

describe("barajar", () => {
  it("no muta el arreglo original y conserva todos los elementos", () => {
    const original = [1, 2, 3, 4, 5];
    const barajado = barajar(original);
    expect(original).toEqual([1, 2, 3, 4, 5]);
    expect([...barajado].sort()).toEqual(original);
  });
});
