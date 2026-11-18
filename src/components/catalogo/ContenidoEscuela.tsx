import { ChevronDownIcon } from "lucide-react";
import { parrafos, type ContenidoEscuela as Contenido } from "@/lib/escuela-contenido";

/**
 * Texto propio de la página de una escuela, debajo de sus cursos: la
 * introducción y las preguntas frecuentes (SEO fase 14, «páginas de escuela
 * como landings»). Se editan en /admin/categorias.
 *
 * Sin texto no se pinta nada: no se inventa contenido para rellenar
 * (CLAUDE.md §3.4, contenido veraz). Las preguntas van en <details>: se leen
 * con teclado y lector de pantalla sin JavaScript, y su texto está en el HTML
 * (los buscadores lo leen aunque esté plegado).
 */
export function ContenidoEscuela({ nombre, contenido }: { nombre: string; contenido: Contenido }) {
  const textos = parrafos(contenido.introduccion);
  if (textos.length === 0 && contenido.preguntas.length === 0) return null;

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-uva-seccion px-uva-margen pb-uva-seccion">
      {textos.length > 0 && (
        <section aria-labelledby="sobre-escuela" className="flex flex-col gap-4 border-t border-uva-divider pt-8">
          <h2 id="sobre-escuela" className="m-0 text-uva-titulo-4 text-balance text-uva-text">
            Qué aprendes en {nombre}
          </h2>
          <div className="flex max-w-[65ch] flex-col gap-4">
            {textos.map((texto, i) => (
              <p key={i} className="m-0 text-uva-cuerpo text-uva-text-muted">
                {texto}
              </p>
            ))}
          </div>
        </section>
      )}

      {contenido.preguntas.length > 0 && (
        <section aria-labelledby="preguntas-escuela" className="flex flex-col gap-4 border-t border-uva-divider pt-8">
          <h2 id="preguntas-escuela" className="m-0 text-uva-titulo-4 text-balance text-uva-text">
            Preguntas frecuentes
          </h2>
          <div className="max-w-[75ch] border-b border-uva-divider">
            {contenido.preguntas.map((p) => (
              <details key={p.pregunta} className="group border-t border-uva-divider">
                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-3 text-uva-cuerpo font-bold text-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent [&::-webkit-details-marker]:hidden">
                  <h3 className="m-0 text-uva-cuerpo font-bold">{p.pregunta}</h3>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="size-5 shrink-0 text-uva-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  />
                </summary>
                <p className="m-0 pb-4 text-uva-cuerpo text-uva-text-muted">{p.respuesta}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
