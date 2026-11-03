import type { ReactNode } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Un renglón de "Qué incluye" (portada, planes y pago). Incluido y no
 * incluido se distinguen por el ícono y, para el lector de pantalla, por
 * texto: no solo por el color (WCAG 1.4.1).
 */
export function BeneficioPlan({ incluido, children }: { incluido: boolean; children: ReactNode }) {
  const Icono = incluido ? Check : X;
  return (
    <li className={cn("flex items-center gap-2", incluido ? "text-uva-text" : "text-uva-text-muted line-through")}>
      <Icono
        className={cn("size-3.5 shrink-0", incluido ? "text-uva-accent-2-text" : "text-uva-text-muted")}
        strokeWidth={2.5}
        aria-hidden
      />
      <span>
        {children}
        {!incluido && <span className="sr-only"> (no incluido)</span>}
      </span>
    </li>
  );
}
