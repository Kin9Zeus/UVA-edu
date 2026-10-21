"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Botón de una acción que no se puede deshacer (eliminar un comentario, una
 * reseña). El primer toque no actúa: muestra en su lugar la pregunta con
 * "Sí, eliminar" y "Cancelar", sin ventana emergente. El foco va a
 * "Cancelar" (lo seguro) y, al cancelar, vuelve al botón.
 */
export function ConfirmarEnLinea({
  etiqueta,
  pregunta,
  onConfirmar,
  disabled = false,
  className,
}: {
  /** Texto del botón: "Eliminar", "Eliminar mi reseña". */
  etiqueta: string;
  /** "¿Eliminar tu reseña?" */
  pregunta: string;
  onConfirmar: () => void;
  disabled?: boolean;
  /** Clases del botón inicial (cada pantalla tiene su estilo de acción). */
  className?: string;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const volverAlBoton = useRef(false);

  useEffect(() => {
    if (confirmando) cancelarRef.current?.focus();
    else if (volverAlBoton.current) {
      volverAlBoton.current = false;
      botonRef.current?.focus();
    }
  }, [confirmando]);

  if (!confirmando) {
    return (
      <button
        ref={botonRef}
        type="button"
        onClick={() => setConfirmando(true)}
        disabled={disabled}
        className={className}
      >
        {etiqueta}
      </button>
    );
  }

  const boton = "inline-flex min-h-11 cursor-pointer items-center rounded-uva-md px-3.5 text-uva-detalle font-semibold";
  return (
    <span role="group" aria-label={pregunta} className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="text-uva-detalle font-semibold text-uva-text">{pregunta}</span>
      <button
        type="button"
        onClick={() => {
          setConfirmando(false);
          onConfirmar();
        }}
        className={cn(boton, "border-0 bg-uva-danger-soft text-uva-danger-text hover:brightness-95")}
      >
        Sí, eliminar
      </button>
      <button
        ref={cancelarRef}
        type="button"
        onClick={() => {
          volverAlBoton.current = true;
          setConfirmando(false);
        }}
        className={cn(boton, "border-[1.5px] border-uva-line-strong bg-transparent text-uva-text hover:border-uva-text")}
      >
        Cancelar
      </button>
    </span>
  );
}
