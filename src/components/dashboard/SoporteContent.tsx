import { Flag, ArrowUpRight } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

// Formulario público de Notion (vista "Reportar bug/incidencias" de la base
// "Bugs / Incidencias") — cada envío cae ahí directo como fila nueva, sin
// backend propio. Fase 1 del plan de soporte: si más adelante se reemplaza
// por un formulario propio dentro de la app, solo hay que cambiar este link
// por la llamada al Server Action correspondiente.
const URL_REPORTE_PROBLEMA = "https://loud-voice-8a9.notion.site/544401bd4fae4293ac2a81538ae09037?pvs=105";

// Placeholder: todavía no hay contenido real para estos 4 puntos (pendiente
// de que el equipo lo redacte). Se deja la estructura de acordeón lista para
// que solo haya que reemplazar `contenido` acá cuando llegue el texto final.
const TEMAS = [
  {
    titulo: "Centro de ayuda",
    contenido: "Contenido en preparación. Pronto encontrarás aquí guías y preguntas frecuentes.",
  },
  {
    titulo: "Contacto",
    contenido: "Contenido en preparación. Pronto encontrarás aquí las formas de comunicarte con nosotros.",
  },
  {
    titulo: "Términos",
    contenido: "Contenido en preparación. Pronto encontrarás aquí los Términos y condiciones de U.V.A.",
  },
  {
    titulo: "Privacidad",
    contenido: "Contenido en preparación. Pronto encontrarás aquí la Política de privacidad de U.V.A.",
  },
] as const;

export function SoporteContent() {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <div>
        <p className="font-mono text-[11px] font-semibold tracking-[.22em] text-uva-accent-text uppercase">
          Soporte
        </p>
        <h1 className="mt-1 text-2xl text-uva-text">¿En qué te podemos ayudar?</h1>
      </div>

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface px-5">
        <Accordion className="flex flex-col">
          {TEMAS.map((tema) => (
            <AccordionItem key={tema.titulo} value={tema.titulo}>
              <AccordionTrigger>{tema.titulo}</AccordionTrigger>
              <AccordionContent>{tema.contenido}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>

        {/* No es un acordeón más: es una acción (sale de la app), no una
            pregunta que se despliega in-place — por eso flecha diagonal en
            vez de chevron, y por eso no vive dentro de <Accordion>. */}
        <a
          href={URL_REPORTE_PROBLEMA}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 border-t border-uva-divider py-4 text-sm font-semibold text-uva-text transition-colors hover:text-uva-accent-text"
        >
          <Flag className="size-4 shrink-0 text-uva-text-faint" strokeWidth={2.2} />
          <span className="flex-1">Reportar un problema</span>
          <ArrowUpRight className="size-4 shrink-0 text-uva-text-faint" strokeWidth={2.2} />
        </a>
      </div>
    </div>
  );
}
