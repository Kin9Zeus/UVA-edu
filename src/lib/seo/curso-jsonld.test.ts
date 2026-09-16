import { describe, expect, it } from "vitest";
import { construirCursoJsonLd, duracionIso8601 } from "@/lib/seo/curso-jsonld";
import { SIN_INSTRUCTOR } from "@/lib/instructores";
import { IMAGEN_PORTADA_PLACEHOLDER } from "@/lib/media";
import type { CursoPublico } from "@/lib/curso";
import type { CalificacionesCurso } from "@/lib/curso-calificaciones";

/**
 * Lo que se prueba aquí no es "que salga un objeto": es cada OMISIÓN
 * condicional. Emitir `aggregateRating` con cero reseñas o una `image` que
 * apunta al placeholder no rompe nada visible —la página se ve igual— pero
 * es structured data inválido, y eso Google lo castiga con acción manual.
 * Un error de estos solo se detecta semanas después, en Search Console.
 */

/**
 * Solo los campos que `construirCursoJsonLd` lee. El `as` evita rellenar los
 * ~15 restantes de `CursoPublico` (progreso, acceso, lección en curso) que no
 * entran al JSON-LD: incluirlos haría creer que influyen en el resultado.
 */
function cursoBase(sobrescribir: Partial<CursoPublico> = {}): CursoPublico {
  return {
    id: "c-1",
    slug: "render-fotorrealista-con-v-ray",
    titulo: "Render fotorrealista con V-Ray",
    descripcion: "Iluminación, materiales y postproducción para arquitectura.",
    nivel: "INTERMEDIO",
    categorias: [{ id: "cat-1", slug: "visualizacion", nombre: "Visualización" }],
    instructores: [
      { id: "i-1", nombre: "Ana Restrepo", especialidad: "Arquitecta", fotoUrl: null },
    ],
    imagenPortada: "https://cdn.uva.test/portadas/vray.jpg",
    fechaEdicion: "2026-09-15T10:00:00.000Z",
    duracionTotalSegundos: 12_000, // 3h 20m
    ...sobrescribir,
  } as CursoPublico;
}

/** Solo importan `promedio` y `total`: el resto de la ficha no entra al JSON-LD. */
function calificaciones(promedio: number | null, total: number): CalificacionesCurso {
  return { promedio, total, reseñas: [], hayMas: false, miCalificacion: null };
}

const SIN_RESENAS = calificaciones(null, 0);
const CON_RESENAS = calificaciones(4.7, 12);

describe("duracionIso8601", () => {
  it("convierte horas y minutos", () => {
    expect(duracionIso8601(12_000)).toBe("PT3H20M");
  });

  it("omite la parte que vale cero", () => {
    expect(duracionIso8601(7_200)).toBe("PT2H");
    expect(duracionIso8601(900)).toBe("PT15M");
  });

  it("59m59s no produce 'PT60M': sube a la hora siguiente", () => {
    expect(duracionIso8601(3_599)).toBe("PT1H");
  });

  it("un curso sin lecciones con duración no declara duración", () => {
    expect(duracionIso8601(0)).toBeNull();
    expect(duracionIso8601(-1)).toBeNull();
    // Menos de medio minuto redondea a cero: no se emite "PT" a secas, que
    // sería una duración ISO 8601 inválida.
    expect(duracionIso8601(20)).toBeNull();
  });
});

describe("construirCursoJsonLd", () => {
  it("declara el tipo y los campos que Google exige para Course", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), CON_RESENAS);

    expect(jsonLd["@type"]).toBe("Course");
    expect(jsonLd.name).toBe("Render fotorrealista con V-Ray");
    expect(jsonLd.description).toBe(
      "Iluminación, materiales y postproducción para arquitectura.",
    );
    expect(jsonLd.provider).toMatchObject({ "@type": "Organization" });
  });

  it("la url apunta SIEMPRE al slug, nunca al uuid con el que se pudo llegar", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), SIN_RESENAS);

    expect(jsonLd.url).toMatch(/\/cursos\/render-fotorrealista-con-v-ray$/);
    // Mismo valor que el `@id`: es el nodo canónico de este curso.
    expect(jsonLd["@id"]).toBe(jsonLd.url);
  });

  it("NO emite aggregateRating cuando el curso no tiene reseñas", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), SIN_RESENAS);

    expect(jsonLd).not.toHaveProperty("aggregateRating");
  });

  it("NO emite aggregateRating si hay total pero el promedio viene null", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), calificaciones(null, 3));

    expect(jsonLd).not.toHaveProperty("aggregateRating");
  });

  it("emite aggregateRating con la escala declarada cuando sí hay reseñas", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), CON_RESENAS);

    expect(jsonLd.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: 4.7,
      ratingCount: 12,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("NO emite image cuando la portada es el placeholder", () => {
    const jsonLd = construirCursoJsonLd(
      cursoBase({ imagenPortada: IMAGEN_PORTADA_PLACEHOLDER }),
      SIN_RESENAS,
    );

    expect(jsonLd).not.toHaveProperty("image");
  });

  it("NO emite instructor cuando el curso no tiene profesor asignado", () => {
    const jsonLd = construirCursoJsonLd(
      cursoBase({
        instructores: [{ id: "x", nombre: SIN_INSTRUCTOR, especialidad: null, fotoUrl: null }],
      }),
      SIN_RESENAS,
    );

    expect(jsonLd).not.toHaveProperty("instructor");
  });

  it("emite el instructor como Person, con la especialidad si la tiene", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), SIN_RESENAS);

    expect(jsonLd.instructor).toEqual([
      { "@type": "Person", name: "Ana Restrepo", jobTitle: "Arquitecta" },
    ]);
  });

  it("traduce el nivel del enum a texto legible", () => {
    expect(construirCursoJsonLd(cursoBase({ nivel: "BASICO" }), SIN_RESENAS).educationalLevel).toBe(
      "Básico",
    );
    expect(
      construirCursoJsonLd(cursoBase({ nivel: "AVANZADO" }), SIN_RESENAS).educationalLevel,
    ).toBe("Avanzado");
  });

  it("declara hasCourseInstance con la modalidad y la carga horaria", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), SIN_RESENAS);

    expect(jsonLd.hasCourseInstance).toEqual({
      "@type": "CourseInstance",
      courseMode: "online",
      courseWorkload: "PT3H20M",
    });
    expect(jsonLd.timeRequired).toBe("PT3H20M");
  });

  it("un curso sin duración declara la modalidad pero no la carga horaria", () => {
    const jsonLd = construirCursoJsonLd(
      cursoBase({ duracionTotalSegundos: 0 }),
      SIN_RESENAS,
    );

    expect(jsonLd.hasCourseInstance).toEqual({
      "@type": "CourseInstance",
      courseMode: "online",
    });
    expect(jsonLd).not.toHaveProperty("timeRequired");
  });

  it("NUNCA declara precio: el acceso es por suscripción, no por curso", () => {
    const jsonLd = construirCursoJsonLd(cursoBase(), CON_RESENAS);

    expect(jsonLd).not.toHaveProperty("offers");
  });
});
