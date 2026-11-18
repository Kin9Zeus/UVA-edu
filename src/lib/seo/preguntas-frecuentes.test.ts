import { describe, expect, it } from "vitest";
import { construirPreguntasJsonLd } from "@/lib/seo/preguntas-frecuentes";
import { camposVacios } from "@/lib/seo/jsonld-util";

describe("construirPreguntasJsonLd", () => {
  it("sin preguntas no publica nada", () => {
    expect(construirPreguntasJsonLd([])).toBeNull();
    expect(construirPreguntasJsonLd([{ pregunta: " ", respuesta: "x" }])).toBeNull();
  });

  it("arma FAQPage con Question y Answer, en el mismo orden que se ve", () => {
    const jsonLd = construirPreguntasJsonLd([
      { pregunta: "¿Necesito saber Revit?", respuesta: "No, el curso empieza desde cero." },
      { pregunta: "¿Dan certificado?", respuesta: "Sí, al aprobar el examen final." },
    ]);
    expect(jsonLd).toEqual({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "¿Necesito saber Revit?",
          acceptedAnswer: { "@type": "Answer", text: "No, el curso empieza desde cero." },
        },
        {
          "@type": "Question",
          name: "¿Dan certificado?",
          acceptedAnswer: { "@type": "Answer", text: "Sí, al aprobar el examen final." },
        },
      ],
    });
    expect(camposVacios(jsonLd!)).toEqual([]);
  });

  it("descarta la pregunta incompleta en vez de publicarla vacía", () => {
    const jsonLd = construirPreguntasJsonLd([
      { pregunta: "¿Hay clases en vivo?", respuesta: "" },
      { pregunta: "¿Cuánto dura?", respuesta: "Unas 6 horas." },
    ]);
    expect((jsonLd!.mainEntity as unknown[]).length).toBe(1);
  });
});
