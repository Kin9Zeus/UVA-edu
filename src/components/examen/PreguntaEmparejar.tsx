"use client";

import { useState } from "react";
import { Check } from "lucide-react";

/**
 * Pregunta tipo EMPAREJAR: tocar una tarjeta de la izquierda la selecciona,
 * tocar una de la derecha arma el par. Tap-to-match y no drag-and-drop
 * (a diferencia del reordenamiento de preguntas en el admin, que sí usa
 * @dnd-kit): más simple, más accesible por teclado y mejor en móvil que
 * arrastrar para esta interacción de "elegir dos cosas que van juntas".
 *
 * El mapa que arma (`idIzquierda -> idDerecha`) es exactamente la forma que
 * espera `calificarPregunta` para EMPAREJAR (src/lib/examenes/calificar.ts):
 * el mismo id sirve de llave en ambos lados, así que ni este componente ni
 * el que lo usa necesitan saber cuál es la pareja correcta.
 */
export function PreguntaEmparejar({
  izquierdas,
  derechas,
  valor,
  onCambiar,
  disabled,
}: {
  izquierdas: { id: string; texto: string }[];
  derechas: { id: string; texto: string }[];
  valor: Record<string, string>;
  onCambiar: (valor: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const derechasUsadas = new Set(Object.values(valor));

  function tocarIzquierda(id: string) {
    if (disabled) return;
    // Tocar un par ya armado lo deshace, para poder corregirlo sin un botón
    // "deshacer" aparte.
    if (id in valor) {
      onCambiar(Object.fromEntries(Object.entries(valor).filter(([izquierda]) => izquierda !== id)));
      setSeleccionada(null);
      return;
    }
    setSeleccionada((actual) => (actual === id ? null : id));
  }

  function tocarDerecha(id: string) {
    if (disabled || seleccionada === null || derechasUsadas.has(id)) return;
    onCambiar({ ...valor, [seleccionada]: id });
    setSeleccionada(null);
  }

  return (
    <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Relaciona cada elemento de la izquierda con su pareja">
      <div className="flex flex-col gap-2">
        {izquierdas.map((item) => {
          const armado = item.id in valor;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              aria-pressed={armado || seleccionada === item.id}
              onClick={() => tocarIzquierda(item.id)}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-uva-md border px-3 py-2 text-left text-[13.5px] transition-colors ${
                armado
                  ? "border-uva-valid bg-uva-success-soft text-uva-text"
                  : seleccionada === item.id
                    ? "border-uva-accent bg-uva-accent-soft text-uva-text"
                    : "border-uva-divider bg-uva-surface-2 text-uva-muted hover:border-uva-muted-2"
              }`}
            >
              {item.texto}
              {armado && <Check className="size-4 shrink-0 text-uva-success-text" aria-hidden />}
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {derechas.map((item) => {
          const usada = derechasUsadas.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled || usada}
              aria-pressed={usada}
              onClick={() => tocarDerecha(item.id)}
              className={`flex min-h-11 items-center justify-between gap-2 rounded-uva-md border px-3 py-2 text-left text-[13.5px] transition-colors ${
                usada
                  ? "border-uva-valid bg-uva-success-soft text-uva-text"
                  : "border-uva-divider bg-uva-surface-2 text-uva-muted hover:border-uva-muted-2"
              }`}
            >
              {item.texto}
              {usada && <Check className="size-4 shrink-0 text-uva-success-text" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
