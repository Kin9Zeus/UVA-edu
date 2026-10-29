import Link from "next/link";
import type { ReactNode } from "react";
import {
  aSegmentos,
  indiceDeBloques,
  type Bloque,
  type EnLinea,
} from "@/lib/legal/bloques";

/**
 * Dibuja el contenido de un texto legal (lista de bloques, ver
 * lib/legal/bloques.ts). Componente de servidor, sin estado: nada de lo que
 * hay aquí necesita JavaScript en el navegador.
 *
 * Las tablas se dibujan dos veces a propósito: una tabla real desde `md` (y
 * al imprimir) y, en celular, una lista de fichas con la etiqueta de cada
 * columna antes de cada dato. Una tabla de tres columnas en 320 px obliga a
 * un scroll horizontal dentro de la página o a letra ilegible, y volver
 * `<td>` bloques con CSS le quita a VoiceOver la semántica de tabla. Cada
 * versión se oculta con `display: none` en el tamaño que no le toca, así que
 * un lector de pantalla nunca lee la tabla dos veces.
 */

const ENLACE =
  "text-uva-accent-ink underline underline-offset-3 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

function EnLineaTexto({ contenido }: { contenido: EnLinea }) {
  return (
    <>
      {aSegmentos(contenido).map((segmento, indice) => {
        let nodo: ReactNode = segmento.texto;
        if (segmento.negrita) nodo = <strong>{nodo}</strong>;
        if (segmento.cursiva) nodo = <em>{nodo}</em>;
        if (segmento.enlace) {
          const href = segmento.enlace;
          // Solo https y mailto salen del sitio; una ruta del sitio navega
          // en la misma pestaña.
          const externo = href.startsWith("https://");
          nodo = href.startsWith("/") ? (
            <Link href={href} className={ENLACE}>
              {nodo}
            </Link>
          ) : (
            <a
              href={href}
              className={ENLACE}
              {...(externo ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            >
              {nodo}
              {externo && <span className="sr-only"> (abre en otra pestaña)</span>}
            </a>
          );
        }
        return <span key={indice}>{nodo}</span>;
      })}
    </>
  );
}

export function TextoLegal({ bloques }: { bloques: Bloque[] }) {
  // Mismos ids que el índice de la página: salen de la misma función.
  const ids = indiceDeBloques(bloques);
  let siguienteTitulo = 0;

  return (
    <div className="flex flex-col gap-5 text-uva-cuerpo text-uva-text">
      {bloques.map((bloque, indice) => {
        switch (bloque.tipo) {
          case "titulo": {
            const id = ids[siguienteTitulo++].id;
            return bloque.nivel === 2 ? (
              <h2
                key={indice}
                id={id}
                className="mt-6 scroll-mt-24 text-uva-titulo-3 text-balance text-uva-text"
              >
                {bloque.texto}
              </h2>
            ) : (
              <h3
                key={indice}
                id={id}
                className="mt-2 scroll-mt-24 text-uva-titulo-4 text-balance text-uva-text"
              >
                {bloque.texto}
              </h3>
            );
          }
          case "parrafo":
            return (
              <p key={indice} className="wrap-anywhere">
                <EnLineaTexto contenido={bloque.contenido} />
              </p>
            );
          case "nota":
            return (
              <div
                key={indice}
                role="note"
                className="rounded-uva-md border border-uva-line-strong bg-uva-surface p-4 wrap-anywhere"
              >
                <EnLineaTexto contenido={bloque.contenido} />
              </div>
            );
          case "lista": {
            const Lista = bloque.ordenada ? "ol" : "ul";
            return (
              <Lista
                key={indice}
                className={`flex flex-col gap-2 pl-6 marker:text-uva-text-muted ${bloque.ordenada ? "list-decimal" : "list-disc"}`}
              >
                {bloque.items.map((item, i) => (
                  <li key={i} className="wrap-anywhere pl-1">
                    <EnLineaTexto contenido={item} />
                  </li>
                ))}
              </Lista>
            );
          }
          case "tabla":
            return (
              <div key={indice}>
                {/* Celular: una ficha por fila. */}
                <ul className="flex flex-col gap-3 md:hidden print:hidden">
                  {bloque.filas.map((fila, f) => (
                    <li
                      key={f}
                      className="rounded-uva-md border border-uva-line-strong bg-uva-surface p-4"
                    >
                      <dl className="flex flex-col gap-2">
                        {fila.map((celda, c) => (
                          <div key={c}>
                            <dt className="text-uva-detalle text-uva-text-muted">
                              {bloque.columnas[c]}
                            </dt>
                            <dd className={`wrap-anywhere ${c === 0 ? "font-bold" : ""}`}>
                              <EnLineaTexto contenido={celda} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </li>
                  ))}
                </ul>
                {/* Desde `md` y al imprimir: la tabla. */}
                <table className="hidden w-full border-collapse text-left md:table print:table">
                  <thead>
                    <tr>
                      {bloque.columnas.map((columna, c) => (
                        <th
                          key={c}
                          scope="col"
                          className="border-b-2 border-uva-line-strong px-3 py-2 text-uva-detalle font-bold text-uva-text-muted"
                        >
                          {columna}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {bloque.filas.map((fila, f) => (
                      <tr key={f} className="break-inside-avoid">
                        {fila.map((celda, c) =>
                          c === 0 ? (
                            <th
                              key={c}
                              scope="row"
                              className="border-b border-uva-divider px-3 py-3 align-top font-bold wrap-anywhere"
                            >
                              <EnLineaTexto contenido={celda} />
                            </th>
                          ) : (
                            <td
                              key={c}
                              className="border-b border-uva-divider px-3 py-3 align-top wrap-anywhere"
                            >
                              <EnLineaTexto contenido={celda} />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
