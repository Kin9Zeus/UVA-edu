"use client";

import { useState } from "react";

/**
 * Paleta de colores por pareja (tokens en src/app/globals.css). Cada entrada
 * es un trío de clases YA COMPLETAS —nunca se arma el nombre por interpolación
 * (`bg-uva-pair-${n}`)— porque Tailwind solo genera CSS para clases que
 * aparecen literales en el código fuente.
 *
 * Con solo 6 tonos y hasta MAXIMO_PARES_EMPAREJAR (8, admin manual) pares
 * posibles, el índice da la vuelta (`% length`): dos parejas pueden compartir
 * color en una pregunta grande, pero el número que las acompaña las sigue
 * distinguiendo — el color es un atajo visual, no la única señal.
 */
const PALETA_PAREJAS = [
  { borde: "border-uva-pair-1", fondo: "bg-uva-pair-1-soft", solido: "bg-uva-pair-1" },
  { borde: "border-uva-pair-2", fondo: "bg-uva-pair-2-soft", solido: "bg-uva-pair-2" },
  { borde: "border-uva-pair-3", fondo: "bg-uva-pair-3-soft", solido: "bg-uva-pair-3" },
  { borde: "border-uva-pair-4", fondo: "bg-uva-pair-4-soft", solido: "bg-uva-pair-4" },
  { borde: "border-uva-pair-5", fondo: "bg-uva-pair-5-soft", solido: "bg-uva-pair-5" },
  { borde: "border-uva-pair-6", fondo: "bg-uva-pair-6-soft", solido: "bg-uva-pair-6" },
] as const;

function colorDePareja(numero: number) {
  return PALETA_PAREJAS[(numero - 1) % PALETA_PAREJAS.length];
}

/**
 * Pregunta tipo EMPAREJAR: tocar una tarjeta de la izquierda la selecciona,
 * tocar una de la derecha arma el par — y ese par se manda a calificar EN EL
 * ACTO (`onCambiar`, que en `ExamenRendir` es el mismo `onConfirmar` que
 * usan las preguntas atómicas). Tap-to-match y no drag-and-drop (a
 * diferencia del reordenamiento de preguntas en el admin, que sí usa
 * @dnd-kit): más simple, más accesible por teclado y mejor en móvil que
 * arrastrar para esta interacción de "elegir dos cosas que van juntas".
 *
 * SIN DESHACER: a diferencia de la versión anterior de este componente, un
 * par ya armado NO se puede destocar. Es la misma regla que rige el resto
 * del examen ("la respuesta queda fija al elegir", ver el docstring de
 * `ExamenRendir`) — antes esto era una excepción porque el par vivía solo en
 * el borrador local sin calificarse; ahora cada toque ya viajó al servidor y
 * ya pudo costar una vida, así que deshacerlo sería pedir una segunda
 * oportunidad que ningún otro tipo de pregunta da.
 *
 * Cada elemento de la izquierda lleva su número fijo; al emparejarlo, la
 * tarjeta de la derecha muestra ese mismo número Y EL MISMO COLOR de
 * `colorDePareja` — el color identifica la pareja de un vistazo sin tener que
 * leer el número, el número la identifica igual para quien no distingue esos
 * colores. Ninguno de los dos se pinta de verde/rojo hasta que el servidor
 * responde con un veredicto FINAL de la pregunta (`resultado`): un par que
 * sigue esperando el resultado del servidor (o que ya se confirmó correcto
 * pero la pregunta sigue abierta) se queda con su color de pareja.
 *
 * `resultado === "mal"` solo se pinta sobre el ÚLTIMO par tocado
 * (`ultimoIntento`), no sobre todos los armados: los pares anteriores ya
 * habían sido confirmados correctos uno por uno antes de este —pintarlos de
 * rojo porque el ÚLTIMO falló sería culpar a los que sí estaban bien. Este
 * componente nunca sabe cuál era la pareja correcta de nada (`derechas` solo
 * trae `idMostrado`, nunca la llave real — ver `ParEmparejar` en
 * src/lib/examenes/tipos.ts), así que "cuál es el que falló" es lo único que
 * SÍ puede saber por su cuenta: es, por construcción, el que se acaba de
 * tocar (los anteriores ya habían pasado su propia verificación).
 *
 * El mapa que arma (`idIzquierda -> idDerecha`) es exactamente la forma que
 * espera `calificarPregunta`/`calificarEmparejarParcial` para EMPAREJAR
 * (src/lib/examenes/calificar.ts): el mismo id sirve de llave en ambos
 * lados, así que ni este componente ni el que lo usa necesitan saber cuál es
 * la pareja correcta.
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
  // El id de la izquierda del ÚLTIMO par armado en esta pregunta — sirve
  // solo para saber a cuál pintar de rojo si `resultado` termina en "mal"
  // (ver el docstring de arriba). Se resetea solo: esta pregunta se
  // desmonta entera al pasar a la siguiente (`key={turno}` en
  // ExamenRendir), así que no hace falta limpiarlo a mano.
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

  // `numero` es el de LA PAREJA (el fijo de la izquierda, ya sea que se esté
  // pintando la tarjeta izquierda o la derecha que ya se le emparejó) — es lo
  // que decide qué color de `PALETA_PAREJAS` le toca. `undefined` cuando la
  // derecha todavía no tiene dueño: ahí no hay pareja que colorear.
  function estilo(armado: boolean, activa: boolean, numero: number | undefined, esUltimoIntento: boolean) {
    if (armado && resultado === "bien") return "border-uva-valid bg-uva-valid-soft text-uva-text";
    if (armado && esUltimoIntento && resultado === "mal") {
      return "border-uva-error bg-uva-error-soft text-uva-text";
    }
    if (activa) return "border-uva-accent bg-uva-accent-soft text-uva-text";
    if (armado && numero !== undefined) {
      const { borde, fondo } = colorDePareja(numero);
      return `${borde} ${fondo} text-uva-text`;
    }
    return "border-uva-divider bg-uva-surface text-uva-muted hover:border-uva-muted-2";
  }

  /**
   * `estado`:
   *   "armado"  ya emparejada — número + color de `colorDePareja` (o el
   *             verde/rojo de `resultado`, si ya se calificó y esta es la
   *             que corresponde pintar — ver `esUltimoIntento`).
   *   "activa"  seleccionada del lado izquierdo, esperando su pareja —
   *             acento, no color de pareja: todavía no hay pareja que pintar.
   *   "neutral" izquierda sin tocar (muestra su número apagado, es su
   *             etiqueta fija) o derecha sin usar (sin número, placeholder).
   */
  function insignia(
    numero: number | undefined,
    estado: "armado" | "activa" | "neutral",
    esUltimoIntento: boolean,
  ) {
    const colorSolido = numero !== undefined ? colorDePareja(numero).solido : null;
    const colorVeredicto =
      resultado === "bien" ? "bg-uva-valid text-uva-bg" : esUltimoIntento && resultado === "mal" ? "bg-uva-error text-white" : null;
    return (
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-[5px] font-mono text-[11.5px] font-semibold ${
          numero === undefined
            ? "border border-dashed border-uva-divider text-transparent"
            : estado === "neutral"
              ? "border border-uva-divider text-uva-text-faint"
              : estado === "activa"
                ? "bg-uva-accent text-white"
                : (colorVeredicto ?? `${colorSolido} text-white`)
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
          const activa = seleccionada === item.id;
          const numero = numeroDe.get(item.id);
          const esUltimoIntento = ultimoIntento === item.id;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled}
              aria-pressed={armado || activa}
              onClick={() => tocarIzquierda(item.id)}
              // `h-20` fijo (no `min-h`) a propósito: dos tarjetas del mismo
              // ancho pero alto distinto por su texto se veían como módulos
              // de tamaños distintos. `line-clamp-3` recorta el texto que no
              // entra en esa altura en vez de estirar la tarjeta.
              className={`flex h-20 items-center gap-2 rounded-uva-md border px-2.5 py-2 text-left text-[13.5px] leading-snug transition-colors disabled:cursor-default ${estilo(armado, activa, numero, esUltimoIntento)}`}
            >
              {insignia(numero, armado ? "armado" : activa ? "activa" : "neutral", esUltimoIntento)}
              <span className="line-clamp-3 min-w-0">{item.texto}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        {derechas.map((item) => {
          const duena = izquierdaDe.get(item.id);
          const armado = duena !== undefined;
          const numero = armado ? numeroDe.get(duena) : undefined;
          const esUltimoIntento = duena !== undefined && duena === ultimoIntento;
          return (
            <button
              key={item.id}
              type="button"
              disabled={disabled || (!armado && seleccionada === null)}
              aria-pressed={armado}
              aria-label={armado ? `${item.texto}, emparejada con el ${numero}` : item.texto}
              onClick={() => tocarDerecha(item.id)}
              className={`flex h-20 items-center gap-2 rounded-uva-md border px-2.5 py-2 text-left text-[13.5px] leading-snug transition-colors disabled:cursor-default ${estilo(
                armado,
                false,
                numero,
                esUltimoIntento,
              )} ${!armado && seleccionada !== null ? "border-dashed border-uva-accent/60" : ""}`}
            >
              {insignia(numero, armado ? "armado" : "neutral", esUltimoIntento)}
              <span className="line-clamp-3 min-w-0">{item.texto}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
