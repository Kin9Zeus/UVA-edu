import { describe, expect, it } from "vitest";
import { motivosParaNoPublicar, sePuedePublicar } from "@/lib/admin/publicacion";
import { IMAGEN_PORTADA_PLACEHOLDER } from "@/lib/media";

/** Curso que cumple todo; cada prueba rompe solo lo que quiere comprobar. */
function cursoCompleto() {
  return {
    titulo: "Fundamentos de presupuesto de obra",
    imagenPortada: "https://storage.example/portada.webp",
    modulos: [{ lecciones: [{ estadoProcesamiento: "LISTO" as const }] }],
  };
}

describe("motivosParaNoPublicar", () => {
  it("un curso completo no tiene motivos: se puede publicar", () => {
    expect(motivosParaNoPublicar(cursoCompleto())).toEqual([]);
    expect(sePuedePublicar(cursoCompleto())).toBe(true);
  });

  it("bloquea si no hay título", () => {
    const motivos = motivosParaNoPublicar({ ...cursoCompleto(), titulo: "   " });
    expect(motivos).toContain("El curso necesita un título.");
  });

  it("el placeholder NO cuenta como portada", () => {
    // Es el caso real: crearCurso() deja este valor hasta que se sube una.
    const motivos = motivosParaNoPublicar({
      ...cursoCompleto(),
      imagenPortada: IMAGEN_PORTADA_PLACEHOLDER,
    });
    expect(motivos).toContain("El curso necesita una portada.");
  });

  it("bloquea si la portada es null", () => {
    expect(motivosParaNoPublicar({ ...cursoCompleto(), imagenPortada: null })).toContain(
      "El curso necesita una portada.",
    );
  });

  it("bloquea un curso sin módulos", () => {
    const motivos = motivosParaNoPublicar({ ...cursoCompleto(), modulos: [] });
    expect(motivos).toContain("El curso necesita al menos un módulo.");
  });

  it("bloquea un curso con módulos pero sin ninguna lección", () => {
    const motivos = motivosParaNoPublicar({
      ...cursoCompleto(),
      modulos: [{ lecciones: [] }, { lecciones: [] }],
    });
    expect(motivos).toContain("El curso necesita al menos una lección.");
    // Sí tiene módulos, así que ese motivo concreto no debe aparecer.
    expect(motivos).not.toContain("El curso necesita al menos un módulo.");
  });

  it("bloquea si algún video no está LISTO, y dice cuántos", () => {
    const motivos = motivosParaNoPublicar({
      ...cursoCompleto(),
      modulos: [
        { lecciones: [{ estadoProcesamiento: "LISTO" }, { estadoProcesamiento: "SUBIENDO" }] },
        { lecciones: [{ estadoProcesamiento: "PROCESANDO" }] },
      ],
    });
    expect(motivos).toContain("Hay 2 lecciones cuyo video todavía no está listo.");
  });

  it("usa el singular cuando falta un solo video", () => {
    const motivos = motivosParaNoPublicar({
      ...cursoCompleto(),
      modulos: [{ lecciones: [{ estadoProcesamiento: "PROCESANDO" }] }],
    });
    expect(motivos).toContain("Hay 1 lección cuyo video todavía no está listo.");
  });

  it("cuenta lecciones de TODOS los módulos, no solo del primero", () => {
    const motivos = motivosParaNoPublicar({
      ...cursoCompleto(),
      modulos: [
        { lecciones: [{ estadoProcesamiento: "LISTO" }] },
        { lecciones: [{ estadoProcesamiento: "SUBIENDO" }] },
      ],
    });
    expect(motivos).toContain("Hay 1 lección cuyo video todavía no está listo.");
  });

  it("devuelve todos los motivos a la vez, no solo el primero", () => {
    // El caso de crearCurso({ publicar: true }): recién creado, sin nada.
    const motivos = motivosParaNoPublicar({
      titulo: "",
      imagenPortada: IMAGEN_PORTADA_PLACEHOLDER,
      modulos: [],
    });
    expect(motivos).toHaveLength(3);
    expect(sePuedePublicar({ titulo: "", imagenPortada: null, modulos: [] })).toBe(false);
  });
});
