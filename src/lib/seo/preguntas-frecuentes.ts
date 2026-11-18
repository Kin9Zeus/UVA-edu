import type { PreguntaFrecuente } from "@/lib/escuela-contenido";
import { sinVacios } from "@/lib/seo/jsonld-util";

/**
 * `FAQPage` de schema.org con las preguntas frecuentes VISIBLES de una escuela
 * (SEO/GEO fase 14). Google solo muestra el resultado enriquecido de FAQ a
 * sitios de gobierno y salud, pero el marcado le dice a los buscadores y a los
 * asistentes de IA qué pregunta responde cada texto, que es lo que buscamos
 * para que nos citen.
 *
 * Regla de Google: el marcado debe repetir exactamente lo que se ve en la
 * página. Por eso recibe las mismas preguntas que pinta la plantilla, y sin
 * preguntas no se publica nada (`null`).
 */
export function construirPreguntasJsonLd(preguntas: PreguntaFrecuente[]): Record<string, unknown> | null {
  const validas = preguntas.filter((p) => p.pregunta.trim() && p.respuesta.trim());
  if (validas.length === 0) return null;
  return sinVacios({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: validas.map((p) => ({
      "@type": "Question",
      name: p.pregunta.trim(),
      acceptedAnswer: { "@type": "Answer", text: p.respuesta.trim() },
    })),
  });
}
