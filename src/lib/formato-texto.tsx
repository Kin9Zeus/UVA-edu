import type { ReactNode } from "react";
import { Bold, Italic, Underline, List, ListOrdered, type LucideIcon } from "lucide-react";

/**
 * Formato de texto enriquecido compartido por los comentarios de clase
 * (`src/components/player/PlayerTabs.tsx`) y Comunidad — un único lugar
 * para el par serializar/renderizar, para que nunca se desincronicen entre
 * los dos lugares que lo usan.
 *
 * El editor es un `contenteditable`: negrita/cursiva/listas se aplican en
 * vivo con `execCommand` sobre la selección. Lo que se guarda en la base de
 * datos sigue siendo un `string` plano de siempre (mismo `contenido` que ya
 * validaba Zod) con marcadores de texto (`**negrita**`, `*cursiva*`,
 * `++subrayado++`, "- item", "1. item") — cero cambios de esquema, cero
 * HTML persistido (nada que sanitizar).
 */

export type FormatoId = "bold" | "italic" | "underline" | "list" | "list-ordered";

export const BOTONES_FORMATO: { tipo: FormatoId; icono: LucideIcon; etiqueta: string }[] = [
  { tipo: "bold", icono: Bold, etiqueta: "Negrita" },
  { tipo: "italic", icono: Italic, etiqueta: "Cursiva" },
  { tipo: "underline", icono: Underline, etiqueta: "Subrayado" },
  { tipo: "list", icono: List, etiqueta: "Lista con viñetas" },
  { tipo: "list-ordered", icono: ListOrdered, etiqueta: "Lista numerada" },
];

/** Comando nativo de `execCommand` detrás de cada botón — el editor es un
 * `contenteditable`, así que negrita/cursiva/listas se aplican en vivo sobre
 * la selección, en vez de insertar marcadores de texto que el usuario
 * tendría que ver. La numeración/viñeta la sigue pintando el navegador
 * (por eso alcanza con CSS `list-decimal`/`list-disc` en el editor); la
 * continuación al dar Enter, en cambio, la controlamos a mano en
 * `manejarEnterEnLista` — el comportamiento nativo de Chrome para "Enter al
 * final de un `<li>`" resultó inconsistente en pruebas manuales (a veces
 * degradaba un `<ol>` de un solo item a un `<ul>` en vez de continuar la
 * numeración). */
export const COMANDO_FORMATO: Record<FormatoId, string> = {
  bold: "bold",
  italic: "italic",
  underline: "underline",
  list: "insertUnorderedList",
  "list-ordered": "insertOrderedList",
};

export function alternarFormato(editor: HTMLDivElement, tipo: FormatoId) {
  editor.focus();
  document.execCommand(COMANDO_FORMATO[tipo]);
}

/**
 * Adjuntos (imagen o archivo) incrustados en el texto — solo los usa
 * Comunidad hoy (`src/components/dashboard/comunidad/*`), pero vive acá
 * porque comparte el mismo texto plano serializado que el resto del
 * formato. El marcador es `[[adjunto:TOKEN]]`, siempre solo en su propia
 * línea (nunca mezclado con otro texto): así el renderer lo trata como un
 * bloque propio, igual que un `<pre>` de código, sin tener que decidir cómo
 * encajar una imagen de ancho completo dentro de un párrafo.
 *
 * `TOKEN` es opaco para este módulo — no le importa si es un uuid real ya
 * guardado o un `pendiente:<uuid>` de un archivo que todavía no se subió
 * (eso lo decide quien llama a `renderizarTextoFormateado`/interpreta el
 * texto al publicar, nunca este archivo).
 */
const PATRON_LINEA_ADJUNTO = /^\[\[adjunto:([^\]]+)\]\]$/;

function marcadorAdjunto(token: string): string {
  return `[[adjunto:${token}]]`;
}

function escaparHtml(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** HTML del "chip" no editable que representa un adjunto dentro del
 * `contenteditable` — mismo nodo tanto para uno recién elegido (ver
 * `insertarAdjuntoPendiente`) como para uno ya existente al abrir una
 * publicación para editar (ver `marcadorAHtml`). `contenteditable="false"`
 * lo vuelve una unidad atómica: el navegador ya deja seleccionarlo y
 * borrarlo entero con Backspace/Supr, sin necesitar un botón de "quitar"
 * aparte. El espacio normal después (no de ancho cero: ese no lo quita
 * `.trim()`, y dañaría PATRON_LINEA_ADJUNTO al serializar) le da al cursor
 * un lugar de texto real donde seguir escribiendo justo a continuación. */
function chipAdjuntoHtml(token: string, etiqueta: string): string {
  return (
    `<span contenteditable="false" data-comunidad-adjunto="${escaparHtml(token)}" ` +
    `class="mx-0.5 inline-flex items-center gap-1 rounded-uva-xs bg-uva-hover px-1.5 py-0.5 align-middle text-xs text-uva-text-muted select-none">` +
    `📎 ${escaparHtml(etiqueta)}</span>&nbsp;`
  );
}

/** Inserta el chip de un adjunto recién elegido en la posición actual del
 * cursor — usa `execCommand("insertHTML")` (no manipulación manual de
 * `Range`) precisamente porque ya deja el cursor bien ubicado después del
 * fragmento insertado, gratis. */
export function insertarAdjuntoPendiente(editor: HTMLDivElement, token: string, nombreArchivo: string) {
  editor.focus();
  document.execCommand("insertHTML", false, chipAdjuntoHtml(token, nombreArchivo));
}

function ubicarCursorAlInicio(nodo: Node) {
  const rango = document.createRange();
  rango.selectNodeContents(nodo);
  rango.collapse(true);
  const seleccion = window.getSelection();
  seleccion?.removeAllRanges();
  seleccion?.addRange(rango);
}

/**
 * Reemplaza el Enter nativo dentro de un `<li>`: en un item con contenido,
 * crea el siguiente `<li>` (el navegador solo se encarga de pintar el
 * número/viñeta vía CSS); en un item vacío, sale de la lista y vuelve a un
 * párrafo normal — el patrón estándar de "Enter, Enter para salir".
 */
export function manejarEnterEnLista(evento: KeyboardEvent, editor: HTMLDivElement) {
  if (evento.key !== "Enter" || evento.shiftKey) return;
  const seleccion = window.getSelection();
  if (!seleccion || seleccion.rangeCount === 0) return;
  let nodo: Node | null = seleccion.anchorNode;
  let li: HTMLLIElement | null = null;
  while (nodo && nodo !== editor) {
    if (nodo instanceof HTMLLIElement) {
      li = nodo;
      break;
    }
    nodo = nodo.parentNode;
  }
  if (!li) return;

  evento.preventDefault();
  const lista = li.parentElement;
  if (!lista) return;

  if (li.textContent?.trim() === "") {
    const parrafo = document.createElement("div");
    parrafo.appendChild(document.createElement("br"));
    lista.after(parrafo);
    li.remove();
    if (lista.children.length === 0) lista.remove();
    ubicarCursorAlInicio(parrafo);
    return;
  }

  // Partir el item en el punto del cursor: todo lo que queda después se
  // muda a un <li> nuevo (Word/Docs), no un <li> vacío pegado al final —
  // antes se creaba siempre el <li> vacío sin importar dónde estuviera el
  // cursor, así que el texto después del cursor se quedaba en el item
  // original en vez de pasar al nuevo.
  const rango = seleccion.getRangeAt(0);
  if (!rango.collapsed) rango.deleteContents();

  const rangoResto = document.createRange();
  rangoResto.setStart(rango.startContainer, rango.startOffset);
  rangoResto.setEnd(li, li.childNodes.length);
  const resto = rangoResto.extractContents();

  const nuevoLi = document.createElement("li");
  if (resto.textContent?.trim() === "") {
    nuevoLi.appendChild(document.createElement("br"));
  } else {
    nuevoLi.appendChild(resto);
  }
  li.after(nuevoLi);

  // Si el cursor estaba al principio del item, `li` se queda sin
  // contenido — necesita un <br> para seguir siendo editable/visible.
  if (li.textContent?.trim() === "") {
    li.innerHTML = "";
    li.appendChild(document.createElement("br"));
  }

  ubicarCursorAlInicio(nuevoLi);
}

/**
 * Convierte el HTML del editor `contenteditable` al texto plano que se
 * guarda en la base de datos, usando los mismos marcadores que interpreta
 * `renderizarTextoFormateado` más abajo (**negrita**, *cursiva*,
 * ++subrayado++, "- item" y "1. item"). Mantener ambas funciones en
 * sincronía.
 */
export function serializarEditor(raiz: HTMLElement): string {
  const lineas: string[] = [];

  function textoConEstilos(nodo: ChildNode): string {
    if (nodo.nodeType === Node.TEXT_NODE) return nodo.textContent ?? "";
    if (nodo.nodeType !== Node.ELEMENT_NODE) return "";
    const el = nodo as HTMLElement;
    const token = el.dataset?.comunidadAdjunto;
    if (token) return marcadorAdjunto(token);
    const contenido = Array.from(el.childNodes).map(textoConEstilos).join("");
    switch (el.tagName) {
      case "B":
      case "STRONG":
        return `**${contenido}**`;
      case "I":
      case "EM":
        return `*${contenido}*`;
      case "U":
        return `++${contenido}++`;
      case "BR":
        return "\n";
      default:
        return contenido;
    }
  }

  function procesarBloque(nodo: ChildNode) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      const texto = nodo.textContent ?? "";
      if (texto) lineas.push(texto);
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;
    const el = nodo as HTMLElement;
    if (el.tagName === "UL" || el.tagName === "OL") {
      Array.from(el.children).forEach((item, i) => {
        const contenido = Array.from(item.childNodes).map(textoConEstilos).join("");
        lineas.push(el.tagName === "UL" ? `- ${contenido}` : `${i + 1}. ${contenido}`);
      });
      return;
    }
    if (el.tagName === "BR") {
      lineas.push("");
      return;
    }
    if (el.tagName === "DIV" || el.tagName === "P") {
      lineas.push(Array.from(el.childNodes).map(textoConEstilos).join(""));
      return;
    }
    lineas.push(textoConEstilos(el));
  }

  Array.from(raiz.childNodes).forEach(procesarBloque);
  return lineas.join("\n").trim();
}

/** Convierte negrita/cursiva/subrayado/código de una línea a HTML (el
 * inverso de la parte inline de `textoConEstilos`), escapando el texto
 * plano — usado solo por `marcadorAHtml` para poblar el `contenteditable`
 * al editar una publicación ya existente. No reconoce enlaces sueltos (no
 * hace falta: siguen siendo texto plano dentro del editor, y
 * `analizarLinea` ya los detecta de nuevo al renderizar el resultado) ni
 * el marcador de adjunto (ese lo maneja `marcadorAHtml` línea por línea,
 * antes de llegar acá, porque ocupa la línea entera). */
function lineaAHtmlInline(linea: string): string {
  const patron = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\+\+([^+]+)\+\+/g;
  let resultado = "";
  let ultimo = 0;
  let match: RegExpExecArray | null;
  while ((match = patron.exec(linea))) {
    if (match.index > ultimo) resultado += escaparHtml(linea.slice(ultimo, match.index));
    if (match[1] !== undefined) resultado += `<code>${escaparHtml(match[1])}</code>`;
    else if (match[2] !== undefined) resultado += `<b>${escaparHtml(match[2])}</b>`;
    else if (match[3] !== undefined) resultado += `<i>${escaparHtml(match[3])}</i>`;
    else if (match[4] !== undefined) resultado += `<u>${escaparHtml(match[4])}</u>`;
    ultimo = patron.lastIndex;
  }
  if (ultimo < linea.length) resultado += escaparHtml(linea.slice(ultimo));
  return resultado || "<br>";
}

/**
 * El inverso de `serializarEditor`: reconstruye el HTML del
 * `contenteditable` a partir del texto plano ya guardado — para poder abrir
 * una publicación existente en modo edición con el mismo editor con el que
 * se escribió, en vez de una caja de texto plano aparte.
 *
 * `resolverEtiqueta(token)` da el nombre a mostrar en el chip de cada
 * adjunto ya existente (viene de `ComunidadAdjunto.nombre`, ver
 * comunidad-tipos.ts) — los tokens que reconstruye acá ya son ids reales
 * (el post está publicado), nunca `pendiente:...`.
 *
 * Límite deliberado: un bloque de código (```...```) no vuelve a
 * reconocerse como tal al editar — queda como texto plano con los
 * backticks visibles, editable como cualquier otra línea. Los posts de
 * Comunidad son cortos y el código en bloque es un caso raro ahí; cubrir
 * ese caso implicaba enseñarle a este parser a reconstruir un `<pre>`
 * dentro de un `contenteditable` — más riesgo por un caso marginal, no
 * entra en este cambio.
 */
export function marcadorAHtml(texto: string, resolverEtiqueta: (token: string) => string): string {
  const lineas = texto.split("\n");
  const bloques: string[] = [];
  let i = 0;

  while (i < lineas.length) {
    const linea = lineas[i];
    const matchAdjunto = PATRON_LINEA_ADJUNTO.exec(linea.trim());
    if (matchAdjunto) {
      bloques.push(`<div>${chipAdjuntoHtml(matchAdjunto[1], resolverEtiqueta(matchAdjunto[1]))}</div>`);
      i++;
      continue;
    }
    if (linea.startsWith("- ")) {
      const items: string[] = [];
      while (i < lineas.length && lineas[i].startsWith("- ")) {
        items.push(lineaAHtmlInline(lineas[i].slice(2)));
        i++;
      }
      bloques.push(`<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s/.test(linea)) {
      const items: string[] = [];
      while (i < lineas.length && /^\d+\.\s/.test(lineas[i])) {
        items.push(lineaAHtmlInline(lineas[i].replace(/^\d+\.\s/, "")));
        i++;
      }
      bloques.push(`<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`);
      continue;
    }
    bloques.push(`<div>${lineaAHtmlInline(linea)}</div>`);
    i++;
  }

  return bloques.join("");
}

/** Interpreta negrita/cursiva/subrayado/código/enlaces dentro de una línea.
 * Formatos no anidables. Los enlaces (`http(s)://...` sueltos, sin
 * marcador) se detectan igual que el resto — no es un campo aparte, sigue
 * siendo el mismo texto plano. */
function analizarLinea(linea: string): ReactNode[] {
  const patron = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*|\+\+([^+]+)\+\+|(https?:\/\/[^\s]+)/g;
  const partes: ReactNode[] = [];
  let ultimo = 0;
  let clave = 0;
  let match: RegExpExecArray | null;
  while ((match = patron.exec(linea))) {
    if (match.index > ultimo) partes.push(linea.slice(ultimo, match.index));
    if (match[1] !== undefined) {
      partes.push(
        <code key={clave++} className="rounded-uva-xs bg-[#27272A] px-1.5 py-0.5 font-mono text-[12px]">
          {match[1]}
        </code>,
      );
    } else if (match[2] !== undefined) {
      partes.push(<strong key={clave++}>{match[2]}</strong>);
    } else if (match[3] !== undefined) {
      partes.push(<em key={clave++}>{match[3]}</em>);
    } else if (match[4] !== undefined) {
      partes.push(<u key={clave++}>{match[4]}</u>);
    } else {
      partes.push(
        <a
          key={clave++}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-all text-uva-accent underline decoration-uva-accent/40 underline-offset-2 hover:decoration-uva-accent"
        >
          {match[5]}
        </a>,
      );
    }
    ultimo = patron.lastIndex;
  }
  if (ultimo < linea.length) partes.push(linea.slice(ultimo));
  return partes;
}

/**
 * Convierte el texto plano guardado (con los marcadores de arriba) en JSX.
 *
 * `resolverAdjunto`, si se pasa, se llama con el TOKEN de cada línea que sea
 * exactamente un marcador `[[adjunto:TOKEN]]` y debe devolver el JSX que
 * representa ese adjunto (o `null` si ya no existe). Es opcional y este
 * módulo no sabe nada de qué es un "adjunto" en concreto — solo Comunidad
 * pasa esta función hoy (`ComunidadPostCard`/`ComunidadRespuestaItem`); los
 * comentarios de clase (`PlayerTabs.tsx`) siguen llamando esta función con
 * un solo argumento, exactamente igual que antes, y nunca van a tener este
 * marcador en su texto de todas formas.
 */
export function renderizarTextoFormateado(texto: string, resolverAdjunto?: (token: string) => ReactNode): ReactNode {
  const segmentos = texto.split(/```([\s\S]*?)```/);
  const bloques: ReactNode[] = [];

  segmentos.forEach((segmento, indiceSegmento) => {
    if (indiceSegmento % 2 === 1) {
      bloques.push(
        <pre
          key={`c${indiceSegmento}`}
          className="my-1.5 overflow-x-auto rounded-uva-md bg-[#27272A] p-2.5 font-mono text-[12px] text-uva-text"
        >
          <code>{segmento.trim()}</code>
        </pre>,
      );
      return;
    }

    const lineas = segmento.split("\n").filter((linea) => linea.trim() !== "");
    let i = 0;
    let clave = 0;
    while (i < lineas.length) {
      const linea = lineas[i];
      const matchAdjunto = PATRON_LINEA_ADJUNTO.exec(linea.trim());
      if (matchAdjunto) {
        // Sin `resolverAdjunto` la línea se omite en vez de mostrar el
        // marcador crudo — no hay ningún caso hoy donde esta función se
        // llame sin resolver Y el texto SÍ traiga el marcador (solo
        // Comunidad lo produce, y siempre pasa un resolver), pero omitir
        // es la opción segura si algún día deja de cumplirse.
        if (resolverAdjunto) bloques.push(<span key={`a${indiceSegmento}-${clave++}`}>{resolverAdjunto(matchAdjunto[1])}</span>);
        i++;
        continue;
      }
      if (linea.startsWith("- ")) {
        const items: string[] = [];
        while (i < lineas.length && lineas[i].startsWith("- ")) {
          items.push(lineas[i].slice(2));
          i++;
        }
        bloques.push(
          <ul key={`u${indiceSegmento}-${clave++}`} className="my-1 list-disc space-y-0.5 pl-5">
            {items.map((item, j) => (
              <li key={j}>{analizarLinea(item)}</li>
            ))}
          </ul>,
        );
        continue;
      }
      if (/^\d+\.\s/.test(linea)) {
        const items: string[] = [];
        while (i < lineas.length && /^\d+\.\s/.test(lineas[i])) {
          items.push(lineas[i].replace(/^\d+\.\s/, ""));
          i++;
        }
        bloques.push(
          <ol key={`o${indiceSegmento}-${clave++}`} className="my-1 list-decimal space-y-0.5 pl-5">
            {items.map((item, j) => (
              <li key={j}>{analizarLinea(item)}</li>
            ))}
          </ol>,
        );
        continue;
      }
      bloques.push(
        <p key={`p${indiceSegmento}-${clave++}`} className="my-0.5">
          {analizarLinea(linea)}
        </p>,
      );
      i++;
    }
  });

  return bloques;
}
