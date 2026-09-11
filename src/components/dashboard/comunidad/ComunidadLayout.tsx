import type { ReactNode } from "react";
import { ComunidadSidebarDerecho } from "@/components/dashboard/comunidad/ComunidadSidebarDerecho";

/**
 * Grid de 3 columnas de Comunidad (nav | contenido | contexto), compartido
 * por el feed y el detalle de un post — un solo lugar de layout, ningún
 * sidebar distinto duplicado entre las dos páginas.
 *
 * En mobile y tablet colapsa a una sola columna (el riel derecho
 * desaparece antes que la nav, que ya es cómoda en horizontal — ver
 * `ComunidadCategoriaTabs`): el ancho lateral es la mejora de escritorio
 * que pedía el rediseño, no una obligación en pantallas chicas.
 */
export function ComunidadLayout({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1280px] px-[clamp(20px,3vw,44px)] py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-uva-text">Comunidad</h1>
        <p className="mt-1 text-sm text-uva-text-muted">Comparte proyectos, resuelve dudas y conecta con otros estudiantes.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)_280px] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-8">{nav}</div>
        <div className="min-w-0">{children}</div>
        <div className="hidden lg:sticky lg:top-8 lg:flex lg:flex-col lg:gap-5">
          <ComunidadSidebarDerecho />
        </div>
      </div>
    </div>
  );
}
