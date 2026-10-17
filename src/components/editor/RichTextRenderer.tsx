import { Fragment, type ReactNode } from "react";
import type { DocumentoContenido, NodoContenido } from "@/lib/editor/tipos";
import { esUrlSegura } from "@/lib/editor/seguridad";

/**
 * Renderer del contenido enriquecido de una lección (`lecciones.contenido`,
 * documento Tiptap/ProseMirror) para quien la ve — estudiante en el
 * reproductor o visitante en la vista previa.
 *
 * Deliberadamente NO usa `dangerouslySetInnerHTML`: camina el JSON a mano y
 * decide qué JSX emitir por tipo de nodo/marca. Un tipo que no reconoce
 * (nunca debería salir del editor, pero tampoco hay que confiar ciegamente
 * en eso) se ignora en vez de intentar renderizarlo — no hay forma de que
 * llegue HTML/atributos arbitrarios del autor al DOM del estudiante.
 *
 * No es un componente cliente: puede vivir en un Server Component.
 *
 * `escala`: "compacta" es la letra chica del reproductor con sesión;
 * "lectura" usa la escala fluida (`text-uva-cuerpo`) y las viñetas en rombo
 * amarillo de la dirección visual «Maqueta» (clase sin sesión).
 */
export function RichTextRenderer({
  contenido,
  className,
  escala = "compacta",
}: {
  contenido: DocumentoContenido | null;
  className?: string;
  escala?: Escala;
}) {
  if (!contenido?.content?.length) return null;
  const gap = escala === "lectura" ? "gap-4" : "gap-3";

  return (
    <div className={className ? `flex flex-col ${gap} ${className}` : `flex flex-col ${gap}`}>
      {contenido.content.map((nodo, i) => renderizarBloque(nodo, i, 0, ESTILOS[escala]))}
    </div>
  );
}

type Escala = "compacta" | "lectura";

type Estilos = {
  /** Párrafo suelto (fuera de una lista o cita). */
  parrafo: string;
  /** Párrafo dentro de una lista o cita: hereda letra y color de ellas. */
  parrafoAnidado: string;
  titulos: [string, string, string];
  vinetas: string;
  vineta: string;
  numerada: string;
  tarea: string;
  cita: string;
};

const ESTILOS: Record<Escala, Estilos> = {
  compacta: {
    parrafo: "m-0 max-w-[640px] text-[13.5px] leading-relaxed text-uva-muted",
    parrafoAnidado: "m-0 max-w-[640px] text-[13.5px] leading-relaxed text-uva-muted",
    titulos: ["text-[19px]", "text-[16.5px]", "text-[14.5px]"],
    vinetas: "my-0 list-disc space-y-1 pl-5 text-[13.5px] text-uva-muted",
    vineta: "",
    numerada: "my-0 list-decimal space-y-1 pl-5 text-[13.5px] text-uva-muted",
    tarea: "text-[13.5px] text-uva-muted",
    cita: "text-[13.5px] text-uva-muted",
  },
  lectura: {
    parrafo: "m-0 max-w-[68ch] text-uva-cuerpo text-pretty text-uva-text-muted",
    parrafoAnidado: "m-0",
    titulos: ["text-uva-titulo-4", "text-uva-lead", "text-uva-cuerpo"],
    vinetas: "my-0 flex max-w-[68ch] list-none flex-col gap-2.5 pl-0 text-uva-cuerpo text-uva-text",
    // Rombo amarillo con borde de texto: el marcador de la dirección visual.
    vineta:
      "relative pl-6 before:absolute before:top-[0.55em] before:left-0.5 before:size-2 before:rotate-45 before:border-[1.5px] before:border-uva-text before:bg-uva-accent-2 before:content-['']",
    numerada: "my-0 flex max-w-[68ch] list-decimal flex-col gap-2.5 pl-6 text-uva-cuerpo text-uva-text",
    tarea: "text-uva-cuerpo text-uva-text",
    cita: "max-w-[68ch] text-uva-cuerpo text-uva-text-muted",
  },
};

/**
 * P3-10 (AUDIT-2026-09-04.md): `renderizarBloque` se llama a sí misma en
 * listas, tareas y citas, sin nada que le ponga un piso.
 *
 * Hoy no es explotable y conviene dejar dicho por qué, para que nadie lo lea
 * como un agujero abierto: el contenido solo lo escribe un administrador
 * (`actualizarLeccion` pasa por `requireAdmin`) y el documento entero está
 * acotado a TAMANO_MAXIMO_CONTENIDO (20 000 bytes). Cada nivel de anidamiento
 * cuesta unos 55 caracteres de JSON, así que el peor caso que cabe son ~360
 * niveles: mucho para una lección real, nada para la pila de JavaScript.
 *
 * Se pone igual porque el día que eso cambie —contenido escrito por un
 * PROFESOR, un límite de tamaño más alto, un importador de documentos— el
 * fallo sería una pestaña congelada sin ninguna pista de por qué, y esta
 * guarda cuesta una línea. 30 niveles es un orden de magnitud más de lo que
 * el editor puede producir a mano: la barra de herramientas solo ofrece
 * lista, lista numerada, tareas y cita, y anidar treinta veces a mano no es
 * algo que ocurra por accidente.
 */
const PROFUNDIDAD_MAXIMA = 30;

function renderizarBloque(
  nodo: NodoContenido,
  key: number | string,
  profundidad: number,
  estilos: Estilos,
): ReactNode {
  if (profundidad > PROFUNDIDAD_MAXIMA) return null;
  const profundidadHija = profundidad + 1;

  switch (nodo.type) {
    case "paragraph":
      return (
        <p key={key} className={profundidad > 0 ? estilos.parrafoAnidado : estilos.parrafo}>
          {renderizarInline(nodo.content)}
        </p>
      );
    case "heading": {
      const nivel = Number(nodo.attrs?.level) === 2 ? 2 : Number(nodo.attrs?.level) === 3 ? 3 : 1;
      const Tag = (`h${nivel}`) as "h1" | "h2" | "h3";
      const tamano = estilos.titulos[nivel - 1];
      return (
        <Tag key={key} className={`m-0 font-heading font-bold tracking-[-0.02em] text-uva-text ${tamano}`}>
          {renderizarInline(nodo.content)}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className={estilos.vinetas}>
          {(nodo.content ?? []).map((item, i) => (
            <li key={i} className={estilos.vineta || undefined}>
              {(item.content ?? []).map((hijo, j) => renderizarBloque(hijo, j, profundidadHija, estilos))}
            </li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className={estilos.numerada}>
          {(nodo.content ?? []).map((item, i) => (
            <li key={i}>{(item.content ?? []).map((hijo, j) => renderizarBloque(hijo, j, profundidadHija, estilos))}</li>
          ))}
        </ol>
      );
    case "taskList":
      return (
        <ul key={key} className="my-0 flex flex-col gap-1.5 pl-0">
          {(nodo.content ?? []).map((item, i) => (
            <li key={i} className={`flex items-start gap-2 ${estilos.tarea}`}>
              <input
                type="checkbox"
                checked={Boolean(item.attrs?.checked)}
                disabled
                className="mt-[3px] size-3.5 shrink-0 accent-uva-accent"
              />
              <div className="flex flex-1 flex-col gap-1.5">
                {(item.content ?? []).map((hijo, j) => renderizarBloque(hijo, j, profundidadHija, estilos))}
              </div>
            </li>
          ))}
        </ul>
      );
    case "blockquote":
      return (
        <blockquote
          key={key}
          className={`my-0 flex flex-col gap-2 border-l-2 border-uva-accent py-0.5 pl-3.5 italic ${estilos.cita}`}
        >
          {(nodo.content ?? []).map((hijo, i) => renderizarBloque(hijo, i, profundidadHija, estilos))}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre
          key={key}
          className="my-0 overflow-x-auto rounded-uva-md bg-uva-chip p-3 font-mono text-[12px] text-uva-text"
        >
          <code>{(nodo.content ?? []).map((t) => t.text ?? "").join("")}</code>
        </pre>
      );
    case "horizontalRule":
      return <hr key={key} className="my-1 border-uva-divider" />;
    default:
      return null;
  }
}

function renderizarInline(nodos: NodoContenido[] | undefined): ReactNode {
  if (!nodos?.length) return null;
  return nodos.map((nodo, i) => {
    if (nodo.type === "hardBreak") return <br key={i} />;
    if (nodo.type === "text") return <Fragment key={i}>{aplicarMarcas(nodo)}</Fragment>;
    return null;
  });
}

function aplicarMarcas(nodo: NodoContenido): ReactNode {
  let contenido: ReactNode = nodo.text ?? "";
  for (const marca of nodo.marks ?? []) {
    switch (marca.type) {
      case "bold":
        contenido = <strong>{contenido}</strong>;
        break;
      case "italic":
        contenido = <em>{contenido}</em>;
        break;
      case "underline":
        contenido = <u>{contenido}</u>;
        break;
      case "strike":
        contenido = <s>{contenido}</s>;
        break;
      case "code":
        contenido = (
          <code className="rounded-uva-xs bg-uva-chip px-1.5 py-0.5 font-mono text-[12px] text-uva-text">
            {contenido}
          </code>
        );
        break;
      case "link": {
        const href = typeof marca.attrs?.href === "string" ? marca.attrs.href : "";
        if (esUrlSegura(href)) {
          contenido = (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer nofollow ugc"
              className="text-uva-accent-ink underline underline-offset-2 hover:text-uva-accent-hover"
            >
              {contenido}
            </a>
          );
        }
        break;
      }
      default:
        break;
    }
  }
  return contenido;
}
