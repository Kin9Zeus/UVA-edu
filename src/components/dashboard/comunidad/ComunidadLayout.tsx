import type { ReactNode } from "react";
import { ComunidadSidebarDerecho } from "@/components/dashboard/comunidad/ComunidadSidebarDerecho";
import { cn } from "@/lib/utils";

/**
 * Grid de Comunidad (nav | contenido | contexto), compartido por el feed y
 * el detalle de un post — un solo lugar de layout, ningún sidebar distinto
 * duplicado entre las dos páginas.
 *
 * Las columnas entran por etapas porque el Sidebar del dashboard ya ocupa
 * 248 px a la izquierda: con las tres desde `lg`, a 1024 px al feed le
 * quedaban ~170 px, menos que en un teléfono. El riel izquierdo entra en
 * `lg` (feed de ~480 px a 1024) y el derecho recién en `xl`. Por debajo de
 * `lg` va todo en una columna, con la nav como fila con scroll (ver
 * `ComunidadCategoriaTabs`).
 *
 * `ocultarNavEnMovil`: en el detalle de un post la nav no marca nada activo
 * y ya está "Volver"; en una sola columna solo empujaba la publicación
 * hacia abajo.
 */
export function ComunidadLayout({
  nav,
  ocultarNavEnMovil = false,
  children,
}: {
  nav: ReactNode;
  ocultarNavEnMovil?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-[1280px] px-[clamp(20px,3vw,44px)] py-8">
      <div className="mb-6">
        <h1 className="font-heading text-2xl text-uva-text">Comunidad</h1>
        <p className="mt-1 text-sm text-uva-text-muted">Comparte proyectos, resuelve dudas y conecta con otros estudiantes.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[200px_minmax(0,1fr)_280px]">
        <div className={cn("min-w-0 lg:sticky lg:top-8", ocultarNavEnMovil && "hidden lg:block")}>{nav}</div>
        <div className="min-w-0">{children}</div>
        <div className="hidden xl:sticky xl:top-8 xl:flex xl:flex-col xl:gap-5">
          <ComunidadSidebarDerecho />
        </div>
      </div>
    </div>
  );
}
