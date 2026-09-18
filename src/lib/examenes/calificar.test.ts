import { describe, expect, it } from "vitest";
import {
  barajar,
  calcularVidasRestantes,
  calificarPregunta,
  normalizarRespuestaCorta,
} from "@/lib/examenes/calificar";
import {
  prepararPreguntasParaEstudiante,
  VIDAS_INICIALES,
  type ParEmparejar,
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
    paresIzquierda: null,
    paresDerecha: null,
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

describe("calificarPregunta — EMPAREJAR", () => {
  const pares: ParEmparejar[] = [
    { id: "p1", izquierda: "Centralizar", derecha: "Proceso claro" },
    { id: "p2", izquierda: "Veracidad", derecha: "Datos actualizados" },
    { id: "p3", izquierda: "Evitar duplicados", derecha: "Una sola fuente" },
  ];
  // `idMostrado` DISTINTO de `id` a propósito: si el test usara el mismo
  // valor para las dos columnas (como hacía la versión con la fuga
  // encontrada en revisión), no detectaría una regresión que vuelva a
  // comparar contra `par.id` en vez de `par.idMostrado`.
  const paresDerecha = [
    { id: "p1", izquierda: "Centralizar", derecha: "Proceso claro", idMostrado: "d1" },
    { id: "p2", izquierda: "Veracidad", derecha: "Datos actualizados", idMostrado: "d2" },
    { id: "p3", izquierda: "Evitar duplicados", derecha: "Una sola fuente", idMostrado: "d3" },
  ];
  const emparejar = pregunta({
    tipo: "EMPAREJAR",
    opciones: null,
    paresIzquierda: pares,
    paresDerecha,
  });

  it("acierta cuando cada par mapea al idMostrado de su propia derecha", () => {
    expect(calificarPregunta(emparejar, { p1: "d1", p2: "d2", p3: "d3" })).toBe(true);
  });

  it("responder con el `id` real (no el idMostrado) no acierta — es justo lo que evita la fuga", () => {
    expect(calificarPregunta(emparejar, { p1: "p1", p2: "p2", p3: "p3" })).toBe(false);
  });

  it("falla si un solo par está cruzado", () => {
    expect(calificarPregunta(emparejar, { p1: "d2", p2: "d1", p3: "d3" })).toBe(false);
  });

  it("falla si falta un par sin emparejar (todo o nada, como el resto de tipos)", () => {
    expect(calificarPregunta(emparejar, { p1: "d1", p2: "d2" })).toBe(false);
  });

  it("una respuesta que no es un mapa (string, array o undefined) no acierta", () => {
    expect(calificarPregunta(emparejar, "p1")).toBe(false);
    expect(calificarPregunta(emparejar, ["p1"])).toBe(false);
    expect(calificarPregunta(emparejar, undefined)).toBe(false);
  });

  it("una pregunta sin pares nunca se da por acertada", () => {
    const rota = pregunta({ tipo: "EMPAREJAR", opciones: null, paresIzquierda: [], paresDerecha: [] });
    expect(calificarPregunta(rota, {})).toBe(false);
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

  it("EMPAREJAR: el id de cada elemento de la derecha nunca coincide con la llave real del par (regresión de la fuga encontrada en revisión)", () => {
    const pares: ParEmparejar[] = [
      { id: "real-1", izquierda: "A", derecha: "1" },
      { id: "real-2", izquierda: "B", derecha: "2" },
    ];
    const paresDerecha = pares.map((par) => ({ ...par, idMostrado: `oculto-${par.id}` }));
    const [publica] = prepararPreguntasParaEstudiante([
      pregunta({ tipo: "EMPAREJAR", opciones: null, paresIzquierda: pares, paresDerecha }),
    ]);

    const idsIzquierda = new Set(publica.izquierdas?.map((item) => item.id));
    const idsDerecha = new Set(publica.derechas?.map((item) => item.id));

    // Si algún id de la izquierda también apareciera en la derecha, ese id
    // compartido SERÍA la respuesta correcta — exactamente el bug que este
    // test existe para atrapar.
    for (const id of idsIzquierda) {
      expect(idsDerecha.has(id)).toBe(false);
    }
    // El id "oculto" (idMostrado) sí puede salir — es lo que reemplaza al
    // real precisamente para que este no salga.
    expect(idsDerecha).toEqual(new Set(["oculto-real-1", "oculto-real-2"]));
  });
});

describe("calcularVidasRestantes", () => {
  // Las vidas salen del contador `ProgresoIntento.fallos` y no de contar
  // respuestas incorrectas: con la cola de reintentos, una pregunta fallada y
  // luego acertada solo deja su respuesta buena en `resueltas`, así que ese
  // fallo no dejaría ningún rastro que contar.
  it("sin fallos, empieza con todas las vidas", () => {
    expect(calcularVidasRestantes(0)).toBe(VIDAS_INICIALES);
  });

  it("cada fallo resta una vida", () => {
    expect(calcularVidasRestantes(1)).toBe(VIDAS_INICIALES - 1);
    expect(calcularVidasRestantes(2)).toBe(VIDAS_INICIALES - 2);
  });

  it("agotarlas justo deja 0", () => {
    expect(calcularVidasRestantes(VIDAS_INICIALES)).toBe(0);
  });

  it("nunca baja de 0 aunque el contador se pase", () => {
    expect(calcularVidasRestantes(VIDAS_INICIALES + 3)).toBe(0);
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
