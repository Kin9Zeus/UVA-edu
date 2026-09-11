import { describe, expect, it } from "vitest";
import {
  esUuid,
  slugDisponible,
  slugificar,
  SLUGS_RESERVADOS_CURSO,
  SLUGS_RESERVADOS_LECCION,
} from "./slug";

describe("esUuid", () => {
  it("reconoce el UUID de un curso, sin importar mayúsculas", () => {
    expect(esUuid("0c000000-0000-4000-8000-000000000003")).toBe(true);
    expect(esUuid("0C000000-0000-4000-8000-00000000000A")).toBe(true);
  });

  it("no confunde un slug con un UUID", () => {
    expect(esUuid("render-fotorrealista-con-v-ray")).toBe(false);
    expect(esUuid("0c000000")).toBe(false);
    expect(esUuid("")).toBe(false);
  });
});

describe("slugificar", () => {
  it("quita tildes, pasa a minúsculas y colapsa lo demás a un guion", () => {
    expect(slugificar("Render Fotorrealista con V-Ray", "curso")).toBe("render-fotorrealista-con-v-ray");
    expect(slugificar("Diseño Paramétrico  2")).toBe("diseno-parametrico-2");
    expect(slugificar("Gestión de Obra y Normativa NSR-10", "curso")).toBe(
      "gestion-de-obra-y-normativa-nsr-10",
    );
  });

  it("recorta los guiones de los extremos", () => {
    expect(slugificar("  ¿Qué es BIM?  ")).toBe("que-es-bim");
  });

  it("usa el respaldo si no queda ningún carácter utilizable", () => {
    expect(slugificar("🎬 !!", "curso")).toBe("curso");
  });

  it("no pasa de 60 caracteres", () => {
    expect(slugificar("a".repeat(80))).toHaveLength(60);
  });
});

describe("slugDisponible", () => {
  it("devuelve la base si está libre", () => {
    expect(slugDisponible("revit", ["lumion"])).toBe("revit");
  });

  it("añade el primer sufijo libre", () => {
    expect(slugDisponible("revit", ["revit", "revit-2"])).toBe("revit-3");
  });

  it("recorta la base para que el sufijo no pase del largo máximo", () => {
    const base = "b".repeat(60);
    const libre = slugDisponible(base, [base]);
    expect(libre).toHaveLength(60);
    expect(libre.endsWith("-2")).toBe(true);
  });

  // Los dos casos por los que existen las listas de reservados: sin ellas, la
  // ruta estática hermana gana y la ficha queda inalcanzable sin ningún error.
  it("un curso titulado «Nuevo» no toma /admin/cursos/nuevo", () => {
    expect(slugDisponible(slugificar("Nuevo", "curso"), SLUGS_RESERVADOS_CURSO)).toBe("nuevo-2");
  });

  it("una lección titulada «Examen» no toma /cursos/<curso>/examen", () => {
    expect(slugDisponible(slugificar("Examen", "leccion"), SLUGS_RESERVADOS_LECCION)).toBe("examen-2");
  });
});
