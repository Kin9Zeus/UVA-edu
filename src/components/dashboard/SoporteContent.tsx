import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

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
      </div>
    </div>
  );
}
