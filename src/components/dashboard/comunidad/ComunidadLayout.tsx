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
 *
 * `accion`: el botón de la acción principal. Desde `lg` encabeza el riel
 * (sticky, siempre a la vista); antes se posiciona solo (flota), por eso
 * vive fuera del `<aside>`, que se oculta en esos anchos.
 */
export function ComunidadLayout({
  nav,
  accion,
  ocultarNavEnMovil = false,
  children,
}: {
  nav: ReactNode;
  accion?: ReactNode;
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
          {/* El riel va primero en el orden del documento para que "Nueva
              publicación" sea de lo primero que alcanza el teclado, no lo
              último después de 20 publicaciones; la rejilla lo pinta a la
              derecha. Antes de `lg` es `contents`: el botón flota y el
              contenedor no deja un hueco. */}
          <div className="max-lg:contents lg:sticky lg:top-8 lg:col-start-2 lg:row-start-1 lg:grid lg:gap-[22px]">
            {accion}
            <aside aria-label="Actividad de la comunidad" className="hidden lg:grid lg:gap-[22px]">
              <ComunidadSidebarDerecho />
            </aside>
          </div>
          <div className="@container flex min-w-0 flex-col gap-[18px] lg:col-start-1 lg:row-start-1">{children}</div>
        </div>
      </div>
    </div>
  );
}
