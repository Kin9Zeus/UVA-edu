import { Grape } from "lucide-react";

/**
 * Vidas del examen: una fila de uvas (referencia visual al nombre U.V.A) en
 * el magenta de marca. Las que quedan van rellenas; las perdidas, solo el
 * contorno en gris.
 *
 * `className` fija el tamaño de cada uva (por defecto `size-4`).
 */
export function Uvas({
  vidas,
  total,
  className = "size-4",
}: {
  vidas: number;
  total: number;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-1" role="img" aria-label={`${vidas} de ${total} vidas`}>
      {Array.from({ length: total }, (_, i) => (
        <Grape
          key={i}
          className={`${className} ${i < vidas ? "fill-uva-accent text-uva-accent" : "text-uva-divider"}`}
          aria-hidden
        />
      ))}
    </div>
  );
}
