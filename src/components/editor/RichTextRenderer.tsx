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
 */
export function RichTextRenderer({
  contenido,
  className,
}: {
  contenido: DocumentoContenido | null;
  className?: string;
}) {
  if (!contenido?.content?.length) return null;

  return (
    <div className={className ? `flex flex-col gap-3 ${className}` : "flex flex-col gap-3"}>
      {contenido.content.map((nodo, i) => renderizarBloque(nodo, i))}
    </div>
  );
}

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
  profundidad = 0,
): ReactNode {
  if (profundidad > PROFUNDIDAD_MAXIMA) return null;
  const profundidadHija = profundidad + 1;

  switch (nodo.type) {
    case "paragraph":
      return (
        <p key={key} className="m-0 max-w-[640px] text-[13.5px] leading-relaxed text-uva-muted">
          {renderizarInline(nodo.content)}
        </p>
      );
    case "heading": {
      const nivel = Number(nodo.attrs?.level) === 2 ? 2 : Number(nodo.attrs?.level) === 3 ? 3 : 1;
      const Tag = (`h${nivel}`) as "h1" | "h2" | "h3";
      const tamano = nivel === 1 ? "text-[19px]" : nivel === 2 ? "text-[16.5px]" : "text-[14.5px]";
      return (
        <Tag key={key} className={`m-0 font-heading font-bold tracking-[-0.02em] text-uva-text ${tamano}`}>
          {renderizarInline(nodo.content)}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul key={key} className="my-0 list-disc space-y-1 pl-5 text-[13.5px] text-uva-muted">
          {(nodo.content ?? []).map((item, i) => (
            <li key={i}>{(item.content ?? []).map((hijo, j) => renderizarBloque(hijo, j, profundidadHija))}</li>
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol key={key} className="my-0 list-decimal space-y-1 pl-5 text-[13.5px] text-uva-muted">
          {(nodo.content ?? []).map((item, i) => (
            <li key={i}>{(item.content ?? []).map((hijo, j) => renderizarBloque(hijo, j, profundidadHija))}</li>
          ))}
        </ol>
      );
    case "taskList":
      return (
        <ul key={key} className="my-0 flex flex-col gap-1.5 pl-0">
          {(nodo.content ?? []).map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-[13.5px] text-uva-muted">
              <input
                type="checkbox"
                checked={Boolean(item.attrs?.checked)}
                disabled
                className="mt-[3px] size-3.5 shrink-0 accent-uva-accent"
              />
              <div className="flex flex-1 flex-col gap-1.5">
                {(item.content ?? []).map((hijo, j) => renderizarBloque(hijo, j, profundidadHija))}
              </div>
            </li>
          ))}
        </ul>
      );
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="my-0 flex flex-col gap-2 border-l-2 border-uva-accent py-0.5 pl-3.5 text-[13.5px] text-uva-muted italic"
        >
          {(nodo.content ?? []).map((hijo, i) => renderizarBloque(hijo, i, profundidadHija))}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre
          key={key}
          className="my-0 overflow-x-auto rounded-uva-md bg-[#27272A] p-3 font-mono text-[12px] text-uva-text"
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
          <code className="rounded-uva-xs bg-[#27272A] px-1.5 py-0.5 font-mono text-[12px] text-uva-text">
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
              className="text-uva-accent underline underline-offset-2 hover:text-uva-accent-hover"
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
