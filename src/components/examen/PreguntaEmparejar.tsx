"use client";

import { Fragment, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Pregunta tipo EMPAREJAR (diseño "examen"): tocar una tarjeta de la
 * izquierda la selecciona, tocar una de la derecha arma el par — y ese par se
 * manda a calificar EN EL ACTO (`onCambiar`, que en `ExamenRendir` es el
 * mismo `onConfirmar` que usan las preguntas atómicas). Tocar y no arrastrar:
 * más simple, más accesible por teclado y mejor en celular.
 *
 * SIN DESHACER: un par ya armado no se puede destocar. Es la misma regla que
 * rige el resto del examen ("la respuesta queda fija al elegir", ver
 * `ExamenRendir`): cada toque ya viajó al servidor y ya pudo costar una uva.
 *
 * Cada elemento de la izquierda lleva su número fijo; al emparejarlo, la
 * tarjeta de la derecha muestra ese mismo número, así se lee qué va con qué.
 * Nada se pinta de amarillo (bien) o magenta (mal) hasta que el servidor da
 * el veredicto FINAL de la pregunta (`resultado`).
 *
 * `resultado === "mal"` solo se pinta sobre el ÚLTIMO par tocado
 * (`ultimoIntento`): los anteriores ya se habían confirmado correctos uno por
 * uno. Este componente nunca sabe cuál era la pareja correcta (`derechas`
 * solo trae `idMostrado`, ver `ParEmparejar` en src/lib/examenes/tipos.ts).
 *
 * El mapa que arma (`idIzquierda -> idDerecha`) es exactamente la forma que
 * espera `calificarPregunta`/`calificarEmparejarParcial`
 * (src/lib/examenes/calificar.ts).
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
  // El id de la izquierda del ÚLTIMO par armado: a cuál pintar de magenta si
  // `resultado` termina en "mal". Se reinicia solo: la pregunta se desmonta
  // entera al pasar a la siguiente (`key={turno}` en ExamenRendir).
  const [ultimoIntento, setUltimoIntento] = useState<string | null>(null);
  const numeroDe = new Map(izquierdas.map((item, i) => [item.id, i + 1]));
  const izquierdaDe = new Map(Object.entries(valor).map(([izquierda, derecha]) => [derecha, izquierda]));

  function tocarIzquierda(id: string) {
    // Ya armada: fija, no se toca (ver "SIN DESHACER" arriba).
    if (disabled || id in valor) return;
    setSeleccionada((actual) => (actual === id ? null : id));
  }

  function tocarDerecha(id: string) {
    // Ya usada, o nada seleccionado del otro lado: no hay nada que armar.
    if (disabled || izquierdaDe.has(id) || seleccionada === null) return;
    setUltimoIntento(seleccionada);
    const nuevoValor = { ...valor, [seleccionada]: id };
    setSeleccionada(null);
    onCambiar(nuevoValor);
  }

  function estilo(armado: boolean, activa: boolean, esUltimoIntento: boolean) {
    if (armado && resultado === "bien") return "border-uva-accent-2 bg-uva-accent-2-soft";
    if (armado && esUltimoIntento && resultado === "mal") return "border-uva-accent bg-uva-accent-soft";
    if (activa) return "border-uva-text bg-uva-surface-2";
    if (armado) return "border-uva-line-strong bg-uva-surface";
    return "border-uva-divider bg-uva-surface hover:border-uva-line-strong";
  }

  /** Número de la pareja. Sin dueño (derecha sin usar), un recuadro punteado vacío. */
  function insignia(numero: number | undefined, esUltimoIntento: boolean, armado: boolean) {
    const veredicto =
      armado && resultado === "bien"
        ? "border-uva-accent-2 bg-uva-accent-2 text-uva-on-bright"
        : armado && esUltimoIntento && resultado === "mal"
          ? "border-uva-btn bg-uva-btn text-uva-on-accent"
          : null;
    return (
      <span
        aria-hidden
        className={cn(
          "grid size-6.5 shrink-0 place-items-center rounded-uva-xs border-[1.5px] font-mono text-uva-detalle font-extrabold",
          numero === undefined
            ? "border-dashed border-uva-line-strong text-transparent"
            : (veredicto ?? "border-uva-text bg-uva-text text-uva-bg"),
        )}
      >
        {numero ?? "·"}
      </span>
    );
  }

  const tarjeta =
    "flex h-full min-h-16 w-full items-center gap-3 rounded-uva-md border-[1.5px] px-3.5 py-2.5 text-left text-uva-cuerpo leading-snug text-uva-text transition-colors disabled:cursor-default";

  // Filas de a dos, no dos columnas independientes: `izquierdas[i]` y
  // `derechas[i]` van seguidas para que el grid las ponga en la MISMA fila y
  // las dos celdas tengan la altura de la más alta.
  const filas = Math.max(izquierdas.length, derechas.length);

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-uva-detalle text-uva-text-muted">
        Toca un elemento de la izquierda y luego su pareja de la derecha.
      </p>
      <div
        className={cn(
          "grid grid-cols-2 gap-2.5",
          resultado === "mal" && "animate-uva-sacudir motion-reduce:animate-none",
          resultado === "bien" && "animate-uva-pop motion-reduce:animate-none",
        )}
        role="group"
        aria-label="Relaciona cada elemento de la izquierda con su pareja"
      >
        {Array.from({ length: filas }, (_, fila) => {
          const izquierda = izquierdas[fila];
          const derecha = derechas[fila];

          return (
            <Fragment key={izquierda?.id ?? `izq-vacia-${fila}`}>
              {izquierda ? (
                (() => {
                  const armado = izquierda.id in valor;
                  const activa = seleccionada === izquierda.id;
                  const esUltimoIntento = ultimoIntento === izquierda.id;
                  return (
                    <button
                      type="button"
                      disabled={disabled}
                      aria-pressed={armado || activa}
                      onClick={() => tocarIzquierda(izquierda.id)}
                      className={cn(tarjeta, estilo(armado, activa, esUltimoIntento))}
                    >
                      {insignia(numeroDe.get(izquierda.id), esUltimoIntento, armado)}
                      <span className="min-w-0 flex-1">{izquierda.texto}</span>
                    </button>
                  );
                })()
              ) : (
                <span />
              )}

              {derecha ? (
                (() => {
                  const duena = izquierdaDe.get(derecha.id);
                  const armado = duena !== undefined;
                  const numero = armado ? numeroDe.get(duena) : undefined;
                  const esUltimoIntento = duena !== undefined && duena === ultimoIntento;
                  return (
                    <button
                      type="button"
                      disabled={disabled || (!armado && seleccionada === null)}
                      aria-pressed={armado}
                      aria-label={armado ? `${derecha.texto}, emparejada con el ${numero}` : derecha.texto}
                      onClick={() => tocarDerecha(derecha.id)}
                      className={cn(
                        tarjeta,
                        estilo(armado, false, esUltimoIntento),
                        !armado && seleccionada !== null && "border-dashed border-uva-text",
                      )}
                    >
                      {insignia(numero, esUltimoIntento, armado)}
                      <span className="min-w-0 flex-1">{derecha.texto}</span>
                    </button>
                  );
                })()
              ) : (
                <span />
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
