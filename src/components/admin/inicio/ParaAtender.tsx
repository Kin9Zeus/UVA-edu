"use client";

import { useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Pendiente } from "@/lib/admin/dashboard";
import { cn } from "@/lib/utils";

const TONO: Record<Pendiente["tono"], string> = {
  warning: "bg-uva-badge-warn-bg text-uva-badge-warn-fg",
  error: "bg-uva-badge-danger-bg text-uva-badge-danger-fg",
  success: "bg-uva-badge-success-bg text-uva-badge-success-fg",
  neutral: "bg-uva-badge-neutral-bg text-uva-badge-neutral-fg",
};

const ANCHO_ABIERTO = "(min-width: 1024px)";

function suscribirAncho(avisar: () => void) {
  const consulta = window.matchMedia(ANCHO_ABIERTO);
  consulta.addEventListener("change", avisar);
  return () => consulta.removeEventListener("change", avisar);
}

/**
 * Lo que espera algo del admin. Se pliega: en computador arranca abierto y en
 * celular cerrado, y cerrado dice cuántas cosas hay y cuántas son urgentes.
 * Mientras nadie lo toque, lo abre o lo cierra el CSS según el ancho (sin
 * salto al hidratar); al tocarlo manda lo que eligió la persona.
 */
export function ParaAtender({ pendientes, className }: { pendientes: Pendiente[]; className?: string }) {
  const [elegido, setElegido] = useState<boolean | null>(null);
  // Solo para `aria-expanded` antes de que lo toquen; lo visible lo decide el CSS.
  const anchoAbre = useSyncExternalStore(
    suscribirAncho,
    () => window.matchMedia(ANCHO_ABIERTO).matches,
    () => true,
  );
  const idLista = useId();

  const abierto = elegido ?? anchoAbre;
  const urgentes = pendientes.filter((p) => p.tono === "warning" || p.tono === "error").length;

  return (
    <section
      aria-labelledby={`${idLista}-titulo`}
      className={cn("rounded-uva-lg border border-uva-divider bg-uva-surface", className)}
    >
      {/* Patrón de acordeón: el botón va dentro del título, no al revés. */}
      <h2 className="m-0">
        <button
          type="button"
          aria-expanded={abierto}
          aria-controls={idLista}
          onClick={() => setElegido(!abierto)}
          className={cn(
            "flex min-h-11 w-full items-center gap-2.5 rounded-uva-lg px-4 py-4 text-left sm:px-5",
            elegido === null ? "lg:border-b lg:border-uva-divider" : elegido && "border-b border-uva-divider",
            elegido !== false && "lg:rounded-b-none",
            elegido === true && "rounded-b-none",
          )}
        >
          <span id={`${idLista}-titulo`} className="min-w-0 flex-1 text-uva-cuerpo font-extrabold text-uva-text">
            Para atender
          </span>
          {urgentes > 0 && <StatusBadge tone="warning">{urgentes === 1 ? "1 urgente" : `${urgentes} urgentes`}</StatusBadge>}
          <span className="text-uva-detalle whitespace-nowrap text-uva-text-muted">
            {pendientes.length === 0 ? "Nada pendiente" : pendientes.length === 1 ? "1 cosa" : `${pendientes.length} cosas`}
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4.5 shrink-0 text-uva-muted-2 transition-transform motion-reduce:transition-none",
              elegido === null ? "lg:rotate-180" : elegido && "rotate-180",
            )}
          />
        </button>
      </h2>

      <div id={idLista} className={cn("px-4 pb-3 sm:px-5", elegido === null ? "max-lg:hidden" : !elegido && "hidden")}>
        {pendientes.length === 0 ? (
          <div className="grid justify-items-center gap-1 px-2 py-5 text-center">
            <span
              aria-hidden
              className="mb-1 grid size-10 place-items-center rounded-full bg-uva-badge-success-bg text-uva-badge-success-fg"
            >
              <Check className="size-5" />
            </span>
            <p className="m-0 font-bold text-uva-text">Nada pendiente</p>
            <p className="m-0 max-w-[36ch] text-uva-detalle text-uva-text-muted">
              Aquí sale lo que espere algo de ti: reportes, exámenes, videos con error o cursos listos para publicar.
            </p>
          </div>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {pendientes.map((p) => (
              <li key={p.clave} className="border-t border-uva-divider first:border-t-0">
                <Link
                  href={p.href}
                  className="-mx-2 grid min-h-11 grid-cols-[2.5rem_minmax(0,1fr)_1rem] items-center gap-3 rounded-uva-md px-2 py-3 hover:bg-uva-hover"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-10 place-items-center rounded-uva-md font-mono text-uva-titulo-4 font-extrabold",
                      TONO[p.tono],
                    )}
                  >
                    {p.cantidad ?? <Check className="size-4.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold break-words text-uva-text">{p.titulo}</span>
                    <span className="block text-uva-detalle text-uva-text-muted">{p.detalle}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-4 text-uva-muted-2" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
