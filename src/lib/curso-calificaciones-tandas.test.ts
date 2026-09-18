import { describe, expect, it } from "vitest";
import type { CalificacionCurso } from "@/lib/curso-calificaciones";
import {
  agregarTanda,
  desdeSiguienteTanda,
  quedanMasReseñas,
  reseñasVisibles,
} from "@/lib/curso-calificaciones-tandas";

/** "Ver más reseñas" — cómo se juntan las tandas en la ficha (P2-10). */

function reseña(id: string): CalificacionCurso {
  return {
    id,
    autorId: `autor-${id}`,
    autorNombre: "Ana",
    autorFotoUrl: null,
    puntuacion: 5,
    comentario: null,
    tiempo: "hace 1 día",
    totalMeGusta: 0,
    meGusta: false,
  };
}

const ids = (lista: CalificacionCurso[]) => lista.map((r) => r.id);
const NINGUNA = new Set<string>();

describe("reseñasVisibles", () => {
  it("primera tanda seguida de las adicionales, en orden", () => {
    const visibles = reseñasVisibles([reseña("a"), reseña("b")], { reseñas: [reseña("c")], hayMas: false }, NINGUNA);

    expect(ids(visibles)).toEqual(["a", "b", "c"]);
  });

  it("una reseña repetida entre tandas (se publicó otra entre dos clics) aparece una sola vez", () => {
    const visibles = reseñasVisibles(
      [reseña("a"), reseña("b")],
      { reseñas: [reseña("b"), reseña("c")], hayMas: true },
      NINGUNA,
    );

    expect(ids(visibles)).toEqual(["a", "b", "c"]);
  });

  it("oculta las moderadas en esta visita, estén en la primera tanda o en las adicionales", () => {
    const visibles = reseñasVisibles(
      [reseña("a"), reseña("b")],
      { reseñas: [reseña("c"), reseña("d")], hayMas: false },
      new Set(["a", "d"]),
    );

    expect(ids(visibles)).toEqual(["b", "c"]);
  });

  it("sin adicionales es la primera tanda tal cual", () => {
    expect(ids(reseñasVisibles([reseña("a")], null, NINGUNA))).toEqual(["a"]);
  });
});

describe("desdeSiguienteTanda", () => {
  it("cuenta lo que devolvió el servidor, no lo que se ve", () => {
    // 9 + 9 traídas; aunque una esté repetida y otra oculta, la base ya
    // entregó 18 filas: la siguiente tanda empieza en 18.
    const primera = Array.from({ length: 9 }, (_, i) => reseña(`p${i}`));
    const adicionales = { reseñas: [reseña("p8"), ...Array.from({ length: 8 }, (_, i) => reseña(`s${i}`))], hayMas: true };

    expect(desdeSiguienteTanda(primera, adicionales)).toBe(18);
  });

  it("sin adicionales, después de la primera tanda", () => {
    expect(desdeSiguienteTanda([reseña("a"), reseña("b")], null)).toBe(2);
  });
});

describe("quedanMasReseñas", () => {
  it("antes de cargar, manda la primera tanda", () => {
    expect(quedanMasReseñas(true, null)).toBe(true);
    expect(quedanMasReseñas(false, null)).toBe(false);
  });

  it("después de cargar, manda la última tanda (el botón desaparece al llegar al final)", () => {
    expect(quedanMasReseñas(true, { reseñas: [reseña("x")], hayMas: false })).toBe(false);
  });
});

describe("agregarTanda", () => {
  it("acumula en orden y se queda con el hayMas de la tanda nueva", () => {
    const una = agregarTanda(null, { reseñas: [reseña("a")], hayMas: true });
    const dos = agregarTanda(una, { reseñas: [reseña("b")], hayMas: false });

    expect(ids(dos.reseñas)).toEqual(["a", "b"]);
    expect(dos.hayMas).toBe(false);
  });
});
