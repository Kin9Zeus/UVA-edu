"use client";

import { useEffect, useRef, useState, useTransition, type RefObject } from "react";
import { Clock, Loader2, Plus } from "lucide-react";
import type { ControlReproductor } from "@/components/features/VideoPlayer";
import {
  EditorTextoEnriquecido,
  type EditorTextoEnriquecidoHandle,
} from "@/components/editor/EditorTextoEnriquecido";
import { NotaItem, ordenarNotas } from "@/components/notas/NotaItem";
import { crearNota } from "@/actions/notas/crear";
import { listarNotasDelCurso } from "@/actions/notas/listar";
import type { NotaLeccion } from "@/lib/notas";
import { MAX_CARACTERES_NOTA, MAX_NOTAS_POR_LECCION, formatearTiempoNota } from "@/lib/notas-validacion";

/** Lo mínimo de cada clase del curso para agrupar y enlazar notas. */
export type LeccionDelCurso = { id: string; slug?: string; numero: number; titulo: string };

type Alcance = "clase" | "curso";

/**
 * Pestaña "Notas" del reproductor (docs/notas-leccion.md, fase 1): apuntes
 * privados anclados a un segundo del video.
 *
 * El estado de la lista vive en PlayerContent (`notas`/`onCambiarNotas`),
 * no acá: cambiar de pestaña desmonta este componente, y perder lo recién
 * guardado al volver a la pestaña sería un bug visible.
 *
 * "Todo el curso" (fase 2) agrupa por clase las notas de todo el curso: las
 * de la clase abierta mueven el video; las de otra clase llevan a esa clase
 * en el minuto exacto (`?t=`).
 */
export function NotasTab({
  leccionId,
  cursoSlug,
  lecciones,
  videoListo,
  notas,
  onCambiarNotas,
  controlRef,
  onSaltar,
}: {
  leccionId: string;
  cursoSlug: string;
  /** Temario del curso, en orden (ya lo trae el reproductor). */
  lecciones: LeccionDelCurso[];
  videoListo: boolean;
  notas: NotaLeccion[];
  onCambiarNotas: (actualizar: (notas: NotaLeccion[]) => NotaLeccion[]) => void;
  controlRef: RefObject<ControlReproductor | null>;
  /** Lleva el video a `segundo` y lo trae a la vista. */
  onSaltar: (segundo: number) => void;
}) {
  // Segundo que muestra "Agregar nota en 03:24". Se refresca cada 1 s solo
  // mientras esta pestaña está montada — nunca en cada `timeupdate`.
  const [ahora, setAhora] = useState(0);
  // Segundo congelado de la nota que se está escribiendo; null = sin editor abierto.
  const [segundoNueva, setSegundoNueva] = useState<number | null>(null);
  const [vacia, setVacia] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [guardando, startGuardar] = useTransition();
  const editorRef = useRef<EditorTextoEnriquecidoHandle>(null);
  const botonAgregarRef = useRef<HTMLButtonElement>(null);
  // Si el video estaba reproduciéndose al abrir el editor, se reanuda al
  // guardar o cancelar (D3: pausar mientras se escribe).
  const reanudarAlCerrarRef = useRef(false);

  const [alcance, setAlcance] = useState<Alcance>("clase");
  // Notas de las OTRAS clases del curso. Las de la clase abierta siempre
  // salen de `notas` (el estado vivo), para que lo recién guardado o
  // editado se vea igual en las dos vistas.
  const [notasOtrasClases, setNotasOtrasClases] = useState<NotaLeccion[] | null>(null);
  const [errorCurso, setErrorCurso] = useState<string | null>(null);
  const [cargandoCurso, startCargarCurso] = useTransition();

  function verAlcance(siguiente: Alcance) {
    setAlcance(siguiente);
    if (siguiente !== "curso") return;
    // Se vuelve a pedir en cada cambio a "Todo el curso": es una consulta
    // barata por índice, y así no se muestra una copia vieja.
    setErrorCurso(null);
    startCargarCurso(async () => {
      const resultado = await listarNotasDelCurso(lecciones.map((leccion) => leccion.id));
      if ("error" in resultado) {
        setErrorCurso(resultado.error);
        return;
      }
      setNotasOtrasClases(resultado.notas.filter((nota) => nota.leccionId !== leccionId));
    });
  }

  const obtenerSegundoActual = () => controlRef.current?.segundoActual() ?? 0;

  useEffect(() => {
    const actualizar = () => setAhora(controlRef.current?.segundoActual() ?? 0);
    // La primera lectura va en un timeout, no directo en el efecto ni en el
    // render: leer un ref durante el render no está permitido.
    const primera = setTimeout(actualizar, 0);
    const intervalo = setInterval(actualizar, 1000);
    return () => {
      clearTimeout(primera);
      clearInterval(intervalo);
    };
  }, [controlRef]);

  const enTope = notas.length >= MAX_NOTAS_POR_LECCION;

  function abrirEditor() {
    const control = controlRef.current;
    reanudarAlCerrarRef.current = !!control?.estaReproduciendo();
    control?.pausar();
    setSegundoNueva(Math.floor(control?.segundoActual() ?? ahora));
    setError(null);
    setVacia(true);
  }

  function cerrarEditor() {
    setSegundoNueva(null);
    setVacia(true);
    if (reanudarAlCerrarRef.current) controlRef.current?.reanudar();
    reanudarAlCerrarRef.current = false;
    requestAnimationFrame(() => botonAgregarRef.current?.focus());
  }

  function guardar() {
    const texto = editorRef.current?.obtenerTexto() ?? "";
    if (!texto || segundoNueva === null) return;
    if (texto.length > MAX_CARACTERES_NOTA) {
      setError("La nota es demasiado larga.");
      return;
    }
    setError(null);
    startGuardar(async () => {
      const resultado = await crearNota(leccionId, segundoNueva, texto);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      onCambiarNotas((actuales) => ordenarNotas([...actuales, resultado.nota]));
      setAviso(`Nota guardada en el minuto ${formatearTiempoNota(resultado.nota.segundo)}.`);
      cerrarEditor();
    });
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Anuncios para lectores de pantalla (WCAG 4.1.3). */}
      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>

      <p className="m-0 text-[12.5px] text-uva-muted">
        Solo tú puedes ver tus notas. Toca el minuto de una nota para volver a ese punto del video.
      </p>

      {!videoListo ? (
        <p className="m-0 rounded-uva-md bg-[#27272A] px-[13px] py-[11px] text-[13px] text-uva-muted">
          Podrás agregar notas cuando el video de esta clase esté disponible.
        </p>
      ) : segundoNueva === null ? (
        <button
          ref={botonAgregarRef}
          type="button"
          onClick={abrirEditor}
          disabled={enTope}
          className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-uva-md border border-uva-divider bg-uva-surface px-3.5 py-2.5 text-[13px] font-semibold text-uva-text hover:bg-[#27272A] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Plus className="size-4" strokeWidth={2.5} />
          Agregar nota en
          <span className="font-mono text-uva-accent-text">{formatearTiempoNota(ahora)}</span>
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[12.5px] text-uva-muted">
            <Clock className="size-3.5" strokeWidth={2.4} />
            Nota en el minuto
            <span className="font-mono text-uva-accent-text">{formatearTiempoNota(segundoNueva)}</span>
            <span className="ml-auto">El video está en pausa</span>
          </div>
          <EditorTextoEnriquecido
            ref={editorRef}
            placeholder="Escribe tu nota…"
            autoFocus
            sinAdjuntos
            onCambiar={setVacia}
          />
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={cerrarEditor}
              className="cursor-pointer border-0 bg-transparent p-0 text-[12.5px] font-semibold text-uva-muted hover:text-uva-text"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardando || vacia}
              onClick={guardar}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-uva-md border-0 bg-uva-accent px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-uva-accent-hover disabled:cursor-not-allowed disabled:bg-uva-text/15 disabled:text-uva-text-faint"
            >
              {guardando && <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />}
              {guardando ? "Guardando…" : "Guardar nota"}
            </button>
          </div>
        </div>
      )}

      {enTope && (
        <p className="m-0 text-[12px] text-uva-muted">
          Llegaste al máximo de {MAX_NOTAS_POR_LECCION} notas en esta clase.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 text-[12px] text-uva-error-text">
          {error}
        </p>
      )}

      <div className="h-px bg-uva-divider" />

      <div role="group" aria-label="Qué notas ver" className="flex gap-1 self-start rounded-full bg-[#27272A] p-1">
        {(
          [
            ["clase", "Esta clase"],
            ["curso", "Todo el curso"],
          ] as const
        ).map(([valor, etiqueta]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={alcance === valor}
            onClick={() => verAlcance(valor)}
            className={`cursor-pointer rounded-full border-0 px-3 py-1.5 text-[12px] font-semibold ${
              alcance === valor ? "bg-uva-surface text-uva-text" : "bg-transparent text-uva-muted hover:text-uva-text"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {alcance === "clase" ? (
        notas.length === 0 ? (
          <p className="m-0 text-[13px] text-uva-muted">
            Aún no tienes notas en esta clase. Guarda un apunte en el minuto exacto del video.
          </p>
        ) : (
          <ul className="-mr-2 m-0 flex max-h-[620px] list-none flex-col divide-y divide-uva-divider overflow-y-auto p-0 pr-2">
            {notas.map((nota) => (
              <li key={nota.id} className="min-w-0 py-3.5 first:pt-0 last:pb-0">
                <NotaItem
                  nota={nota}
                  salto={videoListo ? { onSaltar } : null}
                  obtenerSegundoActual={videoListo ? obtenerSegundoActual : undefined}
                  onCambiarNotas={onCambiarNotas}
                  onAviso={setAviso}
                  onEliminada={() => botonAgregarRef.current?.focus()}
                />
              </li>
            ))}
          </ul>
        )
      ) : cargandoCurso && notasOtrasClases === null ? (
        <p className="m-0 flex items-center gap-2 text-[13px] text-uva-muted">
          <Loader2 className="size-3.5 animate-spin" strokeWidth={2.5} />
          Cargando las notas del curso…
        </p>
      ) : errorCurso ? (
        <p role="alert" className="m-0 text-[12px] text-uva-error-text">
          {errorCurso}
        </p>
      ) : (
        <NotasDelCurso
          leccionActualId={leccionId}
          cursoSlug={cursoSlug}
          lecciones={lecciones}
          notasClaseActual={notas}
          notasOtrasClases={notasOtrasClases ?? []}
          videoListo={videoListo}
          onSaltar={onSaltar}
          obtenerSegundoActual={obtenerSegundoActual}
          onCambiarNotasClaseActual={onCambiarNotas}
          onCambiarNotasOtrasClases={(actualizar) =>
            setNotasOtrasClases((actuales) => actualizar(actuales ?? []))
          }
          onAviso={setAviso}
          onEliminada={() => botonAgregarRef.current?.focus()}
        />
      )}
    </div>
  );
}

function NotasDelCurso({
  leccionActualId,
  cursoSlug,
  lecciones,
  notasClaseActual,
  notasOtrasClases,
  videoListo,
  onSaltar,
  obtenerSegundoActual,
  onCambiarNotasClaseActual,
  onCambiarNotasOtrasClases,
  onAviso,
  onEliminada,
}: {
  leccionActualId: string;
  cursoSlug: string;
  lecciones: LeccionDelCurso[];
  notasClaseActual: NotaLeccion[];
  notasOtrasClases: NotaLeccion[];
  videoListo: boolean;
  onSaltar: (segundo: number) => void;
  obtenerSegundoActual: () => number;
  onCambiarNotasClaseActual: (actualizar: (notas: NotaLeccion[]) => NotaLeccion[]) => void;
  onCambiarNotasOtrasClases: (actualizar: (notas: NotaLeccion[]) => NotaLeccion[]) => void;
  onAviso: (mensaje: string) => void;
  onEliminada: () => void;
}) {
  const grupos = lecciones
    .map((leccion) => ({
      leccion,
      esActual: leccion.id === leccionActualId,
      notas:
        leccion.id === leccionActualId
          ? notasClaseActual
          : ordenarNotas(notasOtrasClases.filter((nota) => nota.leccionId === leccion.id)),
    }))
    .filter((grupo) => grupo.notas.length > 0);

  if (grupos.length === 0) {
    return <p className="m-0 text-[13px] text-uva-muted">Aún no tienes notas en este curso.</p>;
  }

  return (
    <div className="-mr-2 flex max-h-[620px] flex-col gap-4 overflow-y-auto pr-2">
      {grupos.map(({ leccion, esActual, notas }) => (
        <section key={leccion.id} aria-labelledby={`notas-clase-${leccion.id}`} className="flex flex-col gap-2">
          {/* Cabecera de la clase: es lo que deja claro a qué clase pertenece
              cada grupo de notas de abajo — número, título, cuántas notas
              tiene, y un badge sólido cuando es la clase que se está viendo. */}
          <div
            id={`notas-clase-${leccion.id}`}
            className={`flex items-start gap-2 rounded-uva-md px-3 py-2 ${
              esActual ? "bg-uva-accent-soft" : "bg-[#27272A]"
            }`}
          >
            <span
              className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full font-mono text-[10px] font-semibold ${
                esActual ? "bg-uva-accent text-white" : "bg-uva-surface text-uva-muted"
              }`}
            >
              {leccion.numero}
            </span>
            {/* Sin `truncate`: el panel es angosto (va en el costado del
                reproductor), pero el título se ve completo aunque ocupe
                varias líneas, en vez de cortarse con "…". */}
            <span className="min-w-0 flex-1 break-words text-[12.5px] font-semibold leading-snug text-uva-text">
              {leccion.titulo}
            </span>
            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-uva-muted">{notas.length}</span>
            {esActual && (
              <span className="mt-0.5 shrink-0 rounded-full bg-uva-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                Esta clase
              </span>
            )}
          </div>
          {/* Borde a la izquierda: agrupa visualmente las notas bajo su
              cabecera sin repetir el nombre de la clase en cada una. */}
          <ul
            className={`m-0 ml-2.5 flex list-none flex-col divide-y divide-uva-divider border-l-2 py-0 pl-3.5 ${
              esActual ? "border-uva-accent/40" : "border-uva-divider"
            }`}
          >
            {notas.map((nota) => (
              <li key={nota.id} className="min-w-0 py-3 first:pt-0 last:pb-0">
                <NotaItem
                  nota={nota}
                  salto={
                    esActual
                      ? videoListo
                        ? { onSaltar }
                        : null
                      : { href: `/cursos/${cursoSlug}/${leccion.slug ?? leccion.id}?t=${nota.segundo}` }
                  }
                  obtenerSegundoActual={esActual && videoListo ? obtenerSegundoActual : undefined}
                  onCambiarNotas={esActual ? onCambiarNotasClaseActual : onCambiarNotasOtrasClases}
                  onAviso={onAviso}
                  onEliminada={onEliminada}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
