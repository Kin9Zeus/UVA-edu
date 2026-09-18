import {
  VIDAS_INICIALES,
  type PreguntaCongelada,
  type RespuestaEstudiante,
} from "@/lib/examenes/tipos";

/**
 * Calificación de un intento de examen. Funciones puras, sin base de datos ni
 * sesión: son la regla de negocio que decide si alguien aprueba un curso, así
 * que se prueban solas (calificar.test.ts) en vez de solo a través de la
 * Server Action que las llama.
 *
 * Corre SIEMPRE en el servidor. El navegador no recibe las respuestas
 * correctas (ver `prepararPreguntasParaEstudiante`), así que no podría
 * calificar aunque quisiera — y el puntaje que llegara desde el cliente no se
 * mira nunca.
 */

/**
 * "V-Ray 6.0" y "vray 6.0" deben contar como la misma respuesta.
 *
 * Descarta diacríticos (NFD + rango de marcas combinantes, mismo truco que
 * `slugificar` en src/lib/slug.ts), pasa a minúsculas y elimina TODO lo que no
 * sea letra o dígito — espacios y signos incluidos. Por eso "3ds max",
 * "3dsmax" y "3DS-Max" colapsan al mismo valor.
 *
 * Es deliberadamente permisivo: en una respuesta corta el error que importa es
 * conceptual, no ortográfico, y el costo de un falso negativo (reprobar a
 * quien sabía) es mucho más alto que el de un falso positivo. Cuando eso no
 * alcanza, el admin puede listar varias respuestas aceptadas para la misma
 * pregunta.
 *
 * Contrapartida conocida: colapsa también respuestas que solo se distinguen
 * por separación ("un aire" / "unaire"). Para una respuesta de una o dos
 * palabras —el uso real de este tipo— no se ha encontrado un caso donde eso
 * acepte una respuesta genuinamente incorrecta.
 */
export function normalizarRespuestaCorta(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Ids marcados, sin duplicados y en orden estable, para comparar conjuntos.
 * Solo lo usan los tipos de opciones (nunca EMPAREJAR, que se resuelve
 * aparte arriba) — el `Record` de EMPAREJAR no es una lista de ids. */
function conjuntoDeIds(valor: RespuestaEstudiante | undefined): string[] {
  if (valor === undefined) return [];
  const lista = Array.isArray(valor) ? valor : [valor];
  const idsDeTexto = lista.filter((id): id is string => typeof id === "string" && id !== "");
  return [...new Set(idsDeTexto)].sort();
}

/**
 * ¿Está bien respondida esta pregunta?
 *
 * OPCION_MULTIPLE se califica todo-o-nada (el conjunto marcado debe ser
 * exactamente el conjunto correcto). Es la regla más simple de explicarle al
 * estudiante antes de rendir, y la única que no premia marcar todas las
 * opciones para arañar puntos parciales. El precio es que no distingue entre
 * fallar por poco y no tener idea; se acepta a cambio de que el criterio sea
 * predecible.
 */
export function calificarPregunta(
  pregunta: PreguntaCongelada,
  respuesta: RespuestaEstudiante | undefined,
): boolean {
  if (pregunta.tipo === "EMPAREJAR") {
    const pares = pregunta.paresDerecha ?? [];
    // Sin pares no debería existir (mismo caso que "sin ninguna opción
    // correcta" abajo), pero si se colara no puede darse por acertada por
    // coincidencia de dos conjuntos vacíos.
    if (pares.length === 0) return false;
    if (typeof respuesta !== "object" || respuesta === null || Array.isArray(respuesta)) return false;

    const mapa = respuesta as Record<string, string>;
    // Todo o nada, como el resto de tipos: `par.id` es la llave del lado
    // izquierdo (lo que el estudiante manda como clave del mapa) y
    // `par.idMostrado` es el id OPACO del elemento de la derecha que eligió
    // — nunca `par.id` en ambos lados, porque eso sería la respuesta
    // correcta viajando tal cual (ver el comentario de `ParEmparejar`).
    if (Object.keys(mapa).length !== pares.length) return false;
    return pares.every((par) => mapa[par.id] === par.idMostrado);
  }

  if (pregunta.tipo === "RELLENAR_ESPACIO") {
    if (typeof respuesta !== "string") return false;
    const normalizada = normalizarRespuestaCorta(respuesta);
    // Una respuesta que se queda en nada tras normalizar (espacios, signos)
    // es una pregunta sin responder, no un acierto — aunque el admin hubiera
    // guardado por error una variante aceptada igual de vacía.
    if (normalizada === "") return false;
    return pregunta.respuestasAceptadas.some(
      (aceptada) => normalizarRespuestaCorta(aceptada) === normalizada,
    );
  }

  const correctas = (pregunta.opciones ?? [])
    .filter((opcion) => opcion.correcta)
    .map((opcion) => opcion.id)
    .sort();

  // Pregunta sin ninguna opción correcta: no debería existir (la validación de
  // `preguntaEntradaSchema` la rechaza al guardar), pero si se colara no puede
  // darse por acertada por coincidencia de dos conjuntos vacíos.
  if (correctas.length === 0) return false;

  const marcadas = conjuntoDeIds(respuesta);
  if (marcadas.length !== correctas.length) return false;
  return marcadas.every((id, indice) => id === correctas[indice]);
}

/**
 * Vidas restantes del intento: `VIDAS_INICIALES` menos los fallos acumulados
 * en `ProgresoIntento.fallos`. Única fuente de verdad — la usan tanto
 * `responderPregunta` (Server Action que escribe) como `getIntentoEnCurso`
 * (la pantalla que retoma un intento a medias) y `getResultadoIntento`; si
 * divergieran, la UI mostraría un número de corazones distinto al que el
 * servidor usa para decidir si el intento ya se cerró.
 *
 * Ya no se pueden contar las respuestas incorrectas de `resueltas`: con la
 * cola de reintentos, una pregunta fallada y luego acertada solo deja en
 * `resueltas` su respuesta correcta final. El contador de fallos es el único
 * sitio donde queda ese rastro.
 */
export function calcularVidasRestantes(fallos: number): number {
  return Math.max(0, VIDAS_INICIALES - fallos);
}

/**
 * Baraja una copia (Fisher-Yates). `Math.random` y no un CSPRNG a propósito:
 * esto solo decide en qué orden ve alguien sus preguntas — subir el costo de
 * copiarse entre estudiantes, no proteger un secreto. Predecir el orden no da
 * ninguna ventaja porque el contenido no depende de él.
 */
export function barajar<T>(items: readonly T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}
