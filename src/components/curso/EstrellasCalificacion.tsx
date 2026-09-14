"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/** Solo lectura — la fila "4.8 (1314)" del header y cada reseña de la
 * lista. `size` en px, mismo criterio que los íconos inline del resto de
 * Comunidad (size-3.5/size-4 en clases de Tailwind). */
export function EstrellasCalificacion({ puntuacion, size = 14 }: { puntuacion: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${puntuacion} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((valor) => (
        <Star
          key={valor}
          width={size}
          height={size}
          strokeWidth={1.8}
          className={valor <= Math.round(puntuacion) ? "fill-uva-accent text-uva-accent" : "fill-none text-uva-text-faint"}
        />
      ))}
    </span>
  );
}

/** Input clicable de 1 a 5 estrellas — sin librería nueva, mismo patrón que
 * el resto de controles del proyecto (botones planos, sin `<input type="radio">`
 * oculto porque no hace falta enviarlo como parte de un <form> nativo). */
export function EstrellasInput({
  valor,
  onCambiar,
  disabled,
}: {
  valor: number;
  onCambiar: (valor: number) => void;
  disabled?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((estrella) => (
        <button
          key={estrella}
          type="button"
          disabled={disabled}
          onClick={() => onCambiar(estrella)}
          aria-label={`Calificar con ${estrella} estrella${estrella === 1 ? "" : "s"}`}
          className={cn(
            "cursor-pointer border-0 bg-transparent p-0.5 disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          <Star
            size={22}
            strokeWidth={1.8}
            className={estrella <= valor ? "fill-uva-accent text-uva-accent" : "fill-none text-uva-text-faint"}
          />
        </button>
      ))}
    </span>
  );
}
