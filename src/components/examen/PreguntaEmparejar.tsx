"use client";

import { useState } from "react";

/**
 * Pregunta tipo EMPAREJAR: tocar una tarjeta de la izquierda la selecciona,
 * tocar una de la derecha arma el par. Tap-to-match y no drag-and-drop
 * (a diferencia del reordenamiento de preguntas en el admin, que sí usa
 * @dnd-kit): más simple, más accesible por teclado y mejor en móvil que
 * arrastrar para esta interacción de "elegir dos cosas que van juntas".
 *
 * Cada elemento de la izquierda lleva su número fijo; al emparejarlo, la
 * tarjeta de la derecha muestra ese mismo número — así se ve qué va con qué
 * sin pintar de verde algo que todavía no se calificó. El verde/rojo solo
 * aparece con `resultado`, cuando el servidor ya respondió.
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
  resultado,
}: {
  izquierdas: { id: string; texto: string }[];
  derechas: { id: string; texto: string }[];
  valor: Record<string, string>;
  onCambiar: (valor: Record<string, string>) => void;
  disabled: boolean;
  resultado: "bien" | "mal" | null;
}) {
  const [seleccionada, setSeleccionada] = useState<string | null>(null);
  const numeroDe = new Map(izquierdas.map((item, i) => [item.id, i + 1]));
  const izquierdaDe = new Map(Object.entries(valor).map(([izquierda, derecha]) => [derecha, izquierda]));

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
    if (disabled) return;
    const duena = izquierdaDe.get(id);
    // Tocar una derecha ya usada la libera (igual que tocar su izquierda).
    if (duena !== undefined) {
      onCambiar(Object.fromEntries(Object.entries(valor).filter(([izquierda]) => izquierda !== duena)));
      return;
    }
    if (seleccionada === null) return;
    onCambiar({ ...valor, [seleccionada]: id });
    setSeleccionada(null);
  }

  function estilo(armado: boolean, activa: boolean) {
    if (armado && resultado === "bien") return "border-uva-valid bg-uva-valid-soft text-uva-text";
    if (armado && resultado === "mal") return "border-uva-error bg-uva-error-soft text-uva-text";
    if (activa) return "border-uva-accent bg-uva-accent-soft text-uva-text";
    if (armado) return "border-uva-accent/50 bg-uva-surface text-uva-text";
    return "border-uva-divider bg-uva-surface text-uva-muted hover:border-uva-muted-2";
  }

  function insignia(numero: number | undefined, encendida: boolean) {
    return (
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-[5px] font-mono text-[11.5px] font-semibold ${
          numero === undefined
            ? "border border-dashed border-uva-divider text-transparent"
            : encendida
              ? resultado === "bien"
                ? "bg-uva-valid text-uva-bg"
                : resultado === "mal"
                  ? "bg-uva-error text-white"
                  : "bg-uva-accent text-white"
              : "border border-uva-divider text-uva-text-faint"
        }`}
        aria-hidden
      >
        {numero ?? "·"}
      </span>
    );
  }

  return (
    <div
      className={`grid grid-cols-2 gap-2 ${resultado === "mal" ? "animate-uva-sacudir" : resultado === "bien" ? "animate-uva-pop" : ""}`}
      role="group"
      aria-label="Relaciona cada elemento de la izquierda con su pareja"
    >
      <div className="flex flex-col gap-2">
        {izquierdas.map((item) => {
          const armado = item.id in valor;
          const numero = numeroDe.get(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              aria-pressed={armado || seleccionada === item.id}
              onClick={() => tocarIzquierda(item.id)}
              className={`flex min-h-11 items-center gap-2 rounded-uva-md border px-2.5 py-2 text-left text-[13.5px] leading-snug transition-colors disabled:cursor-default ${estilo(armado, seleccionada === item.id)}`}
            >
              {insignia(numero, armado || seleccionada === item.id)}
              <span className="min-w-0">{item.texto}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {derechas.map((item) => {
          const duena = izquierdaDe.get(item.id);
          const armado = duena !== undefined;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled || (!armado && seleccionada === null)}
              aria-pressed={armado}
              aria-label={armado ? `${item.texto}, emparejada con el ${numeroDe.get(duena)}` : item.texto}
              onClick={() => tocarDerecha(item.id)}
              className={`flex min-h-11 items-center gap-2 rounded-uva-md border px-2.5 py-2 text-left text-[13.5px] leading-snug transition-colors disabled:cursor-default ${estilo(
                armado,
                false,
              )} ${!armado && seleccionada !== null ? "border-dashed border-uva-accent/60" : ""}`}
            >
              {insignia(armado ? numeroDe.get(duena) : undefined, armado)}
              <span className="min-w-0">{item.texto}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
