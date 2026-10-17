import { cn } from "@/lib/utils";

/**
 * Vidas del examen: una fila de racimos de uva (referencia al nombre U.V.A.),
 * como el diseño "examen". Las que quedan van rellenas de magenta; las
 * perdidas, solo el contorno.
 *
 * `className` fija el tamaño de cada racimo (por defecto `size-4.5`).
 */
export function Uvas({
  vidas,
  total,
  className = "size-4.5",
}: {
  vidas: number;
  total: number;
  className?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1"
      role="img"
      aria-label={`${vidas} de ${total} ${total === 1 ? "uva" : "uvas"}`}
    >
      {Array.from({ length: total }, (_, i) => (
        <Racimo key={i} llena={i < vidas} className={className} />
      ))}
    </span>
  );
}

function Racimo({ llena, className }: { llena: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("shrink-0", className)}>
      <path
        d="M12 6V2.5M12 4.2c1.6-1.8 3.6-2 5-1.2"
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        className={llena ? "stroke-uva-text" : "stroke-uva-line-strong"}
      />
      <g
        className={llena ? "fill-uva-btn" : "fill-none stroke-uva-line-strong"}
        strokeWidth={llena ? 0 : 1.4}
      >
        <circle cx="7" cy="9" r="3.2" />
        <circle cx="12" cy="9" r="3.2" />
        <circle cx="17" cy="9" r="3.2" />
        <circle cx="9.5" cy="13.8" r="3.2" />
        <circle cx="14.5" cy="13.8" r="3.2" />
        <circle cx="12" cy="18.6" r="3.2" />
      </g>
    </svg>
  );
}
