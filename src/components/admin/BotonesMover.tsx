"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Subir / bajar un paso: la alternativa al arrastre que pide WCAG 2.2
 * (2.5.7, movimientos de arrastre). Sirve con un toque, con mouse y con
 * teclado, y en tableta evita la pulsación larga del asa.
 *
 * El foco se queda en la flecha que se usó, aunque la fila cambie de sitio en
 * el DOM; si esa flecha quedó deshabilitada (llegó al principio o al final),
 * pasa a la otra.
 */
export function BotonesMover({
  nombre,
  posicion,
  total,
  disabled = false,
  onMover,
}: {
  /** "el módulo Fundamentos", "la lección Interfaz", "la pregunta 3". */
  nombre: string;
  /** 0..total-1 */
  posicion: number;
  total: number;
  disabled?: boolean;
  onMover: (destino: number) => void;
}) {
  const arribaRef = useRef<HTMLButtonElement>(null);
  const abajoRef = useRef<HTMLButtonElement>(null);
  const enfocar = useRef<"arriba" | "abajo" | null>(null);

  useEffect(() => {
    const direccion = enfocar.current;
    if (!direccion) return;
    enfocar.current = null;
    const [primero, otro] = direccion === "arriba" ? [arribaRef, abajoRef] : [abajoRef, arribaRef];
    (primero.current && !primero.current.disabled ? primero.current : otro.current)?.focus();
  }, [posicion]);

  function mover(direccion: "arriba" | "abajo") {
    enfocar.current = direccion;
    onMover(posicion + (direccion === "arriba" ? -1 : 1));
  }

  const clase = "shrink-0 text-uva-muted-2 hover:text-uva-text";
  return (
    <>
      <Button
        ref={arribaRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Subir ${nombre}`}
        title="Subir"
        disabled={disabled || posicion === 0}
        className={clase}
        onClick={() => mover("arriba")}
      >
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button
        ref={abajoRef}
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Bajar ${nombre}`}
        title="Bajar"
        disabled={disabled || posicion === total - 1}
        className={clase}
        onClick={() => mover("abajo")}
      >
        <ArrowDown aria-hidden="true" />
      </Button>
    </>
  );
}

/**
 * Resalta un momento la fila que se acaba de mover, para que se vea a dónde
 * fue. Con `prefers-reduced-motion` el cambio de fondo es instantáneo.
 */
export function useRecienMovido() {
  const [id, setId] = useState<string | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const marcar = useCallback((nuevo: string) => {
    clearTimeout(temporizador.current);
    setId(nuevo);
    temporizador.current = setTimeout(() => setId(null), 1200);
  }, []);
  useEffect(() => () => clearTimeout(temporizador.current), []);
  return [id, marcar] as const;
}

/** Clases de la fila resaltada; van con `transition-colors` en la fila. */
export const CLASE_RECIEN_MOVIDO = "bg-uva-accent-soft";
