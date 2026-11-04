"use client";

import type { ReactElement, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * El tooltip de un enlace del Sidebar. Lo carga NavLink (Sidebar.tsx) al
 * primer indicio de uso, para que base-ui y floating-ui no viajen con la
 * página: el tooltip solo aparece con el mouse o el teclado sobre un ícono.
 */
export function TooltipEnlace({
  enlace,
  contenido,
  className,
}: {
  enlace: ReactElement;
  contenido: ReactNode;
  className?: string;
}) {
  return (
    <TooltipProvider delay={150}>
      <Tooltip>
        <TooltipTrigger render={enlace} />
        <TooltipContent className={className}>{contenido}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
