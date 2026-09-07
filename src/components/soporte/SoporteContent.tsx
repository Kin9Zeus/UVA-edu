import { Flag, ArrowUpRight } from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { TEMAS_SOPORTE, URL_REPORTE_PROBLEMA, type TemaSoporte } from "@/lib/soporte";

export function SoporteContent({ temaAbierto }: { temaAbierto?: TemaSoporte }) {
  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <div>
        <p className="font-mono text-[11px] font-semibold tracking-[.22em] text-uva-accent-text uppercase">
          Soporte
        </p>
        <h1 className="mt-1 text-2xl text-uva-text">¿En qué te podemos ayudar?</h1>
      </div>

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface px-5">
        {/* El acordeón es no controlado (el visitante abre y cierra a gusto),
            así que `defaultValue` solo lo lee al montar. La `key` lo remonta
            cuando cambia `?tema=`: sin ella, entrar desde el footer a otro
            tema estando ya en /soporte navegaría sin abrir nada. Los demás
            temas siguen listados y desplegables, solo arrancan cerrados. */}
        <Accordion
          key={temaAbierto ?? "sin-tema"}
          defaultValue={temaAbierto ? [temaAbierto] : []}
          className="flex flex-col"
        >
          {TEMAS_SOPORTE.map((tema) => (
            <AccordionItem key={tema.id} value={tema.id}>
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
