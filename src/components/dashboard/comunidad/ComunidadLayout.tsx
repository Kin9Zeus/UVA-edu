import type { ReactNode } from "react";
import { ComunidadSidebarDerecho } from "@/components/dashboard/comunidad/ComunidadSidebarDerecho";
import { cn } from "@/lib/utils";

/**
 * Armazón de Comunidad (dirección visual Maqueta, «Cartelera»), compartido
 * por el feed y el detalle de un post: las categorías como pestañas arriba
 * del contenido y, desde `xl`, el riel de actividad a la derecha.
 *
 * El contenido es un contenedor (`@container`): la cartelera decide sus
 * columnas por el ancho que le queda, no por el de la ventana — el menú
 * lateral del panel y el riel ya se llevan buena parte.
 *
 * `ocultarNavEnMovil`: en el detalle de un post las pestañas no marcan nada
 * activo y ya está "Volver"; en celular solo empujaban la publicación.
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
    <div className="mx-auto flex w-full max-w-uva flex-col px-uva-margen py-7 lg:py-9">
      {/* Un solo bloque centrado (~1060 px: feed 760 + riel 260 + hueco): el
          título, las pestañas, el feed y el riel comparten el mismo borde
          izquierdo, y en monitores grandes el vacío se reparte a los lados. */}
      <div className="mx-auto flex w-full min-w-0 flex-col gap-[22px] lg:max-w-[1060px] lg:gap-7">
        <div>
          <h1 className="text-uva-titulo-3 text-uva-text">Comunidad</h1>
          <p className="mt-2 text-uva-lead text-uva-text-muted">
            Comparte proyectos, resuelve dudas y conecta con otros estudiantes.
          </p>
        </div>

        <div className={cn("min-w-0", ocultarNavEnMovil && "hidden lg:block")}>{nav}</div>

        <div className="grid grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-x-10">
          <div className="@container flex min-w-0 flex-col gap-[18px]">{children}</div>
          <aside aria-label="Actividad de la comunidad" className="hidden lg:sticky lg:top-8 lg:grid lg:gap-[22px]">
            <ComunidadSidebarDerecho />
          </aside>
        </div>
      </div>
    </div>
  );
}
