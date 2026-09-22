"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, ChevronDown, Lock, NotebookPen, PlayCircle } from "lucide-react";
import { NotaItem, ordenarNotas } from "@/components/notas/NotaItem";
import type { CursoDeNotas, LeccionDeNota, MisNotas, NotaLeccion } from "@/lib/notas";

type GrupoLeccion = { leccionId: string; leccion: LeccionDeNota | null; notas: NotaLeccion[] };
type GrupoCurso = { cursoId: string | null; curso: CursoDeNotas | null; lecciones: GrupoLeccion[] };

/**
 * Agrupa la lista plana por curso y clase. Se recalcula en cada render a
 * partir del estado, así editar o borrar una nota no obliga a mantener dos
 * estructuras sincronizadas.
 */
function agrupar(
  notas: NotaLeccion[],
  lecciones: Record<string, LeccionDeNota>,
  cursos: Record<string, CursoDeNotas>,
): GrupoCurso[] {
  const porLeccion = new Map<string, NotaLeccion[]>();
  for (const nota of notas) {
    porLeccion.set(nota.leccionId, [...(porLeccion.get(nota.leccionId) ?? []), nota]);
  }

  const porCurso = new Map<string | null, GrupoLeccion[]>();
  for (const [leccionId, notasLeccion] of porLeccion) {
    const leccion = lecciones[leccionId] ?? null;
    // Sin datos de lección (curso despublicado sin acceso, p. ej.): se
    // agrupa aparte, `null`, en vez de esconder notas que siguen siendo suyas.
    const cursoId = leccion?.cursoId ?? null;
    porCurso.set(cursoId, [
      ...(porCurso.get(cursoId) ?? []),
      { leccionId, leccion, notas: ordenarNotas(notasLeccion) },
    ]);
  }

  return [...porCurso.entries()]
    .map(([cursoId, grupos]) => ({
      cursoId,
      curso: cursoId ? (cursos[cursoId] ?? null) : null,
      lecciones: grupos.sort(
        (a, b) =>
          (a.leccion?.moduloOrden ?? 0) - (b.leccion?.moduloOrden ?? 0) ||
          (a.leccion?.orden ?? 0) - (b.leccion?.orden ?? 0),
      ),
    }))
    .sort((a, b) => {
      // Las notas sin curso identificable van al final.
      if (!a.curso) return 1;
      if (!b.curso) return -1;
      return a.curso.titulo.localeCompare(b.curso.titulo, "es");
    });
}

export function MisNotasContent({ notas: notasIniciales, lecciones, cursos }: MisNotas) {
  const [notas, setNotas] = useState(notasIniciales);
  const [aviso, setAviso] = useState("");
  const tituloRef = useRef<HTMLHeadingElement>(null);
  // Ids (de curso o de clase) con las notas ocultas. Todo empieza
  // desplegado — colapsar es una acción explícita del usuario, no un
  // estado por defecto que le esconda notas sin haberlo pedido.
  const [colapsados, setColapsados] = useState<Set<string>>(() => new Set());

  function alternar(id: string) {
    setColapsados((actuales) => {
      const siguiente = new Set(actuales);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  const grupos = agrupar(notas, lecciones, cursos);

  return (
    <div className="flex max-w-[1080px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <div className="flex flex-col gap-1.5">
        <h1 ref={tituloRef} tabIndex={-1} className="text-2xl text-uva-text outline-none">
          Mis notas
        </h1>
        <p className="m-0 text-sm text-uva-text-muted">
          Tus apuntes de todas las clases, en el minuto exacto del video. Solo tú puedes verlos.
        </p>
      </div>

      {/* Anuncios para lectores de pantalla (WCAG 4.1.3). */}
      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>

      {grupos.length === 0 ? (
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-8 text-center">
          <NotebookPen className="mx-auto size-8 text-uva-text-faint" strokeWidth={1.6} />
          <p className="mt-3 text-sm text-uva-text-muted">
            Aún no tienes notas. Mientras ves una clase, abre la pestaña Notas para guardar un apunte en el
            minuto exacto.
          </p>
        </div>
      ) : (
        grupos.map((grupo) => {
          const idCurso = grupo.cursoId ?? "sin-curso";
          const totalNotasCurso = grupo.lecciones.reduce((total, l) => total + l.notas.length, 0);
          const cursoColapsado = colapsados.has(idCurso);
          return (
            <section
              key={idCurso}
              aria-labelledby={`notas-curso-${idCurso}`}
              className="flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-surface p-5"
            >
              {/* Cabecera del curso: ícono + título + cuántas notas tiene en
                  total, para diferenciarlo de un vistazo de las demás
                  tarjetas de curso. También es el botón que oculta o
                  vuelve a mostrar sus notas. */}
              <div
                className={`flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 ${cursoColapsado ? "" : "border-b border-uva-divider pb-4"}`}
              >
                <button
                  type="button"
                  onClick={() => alternar(idCurso)}
                  aria-expanded={!cursoColapsado}
                  aria-controls={`notas-curso-contenido-${idCurso}`}
                  className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-uva-md bg-uva-accent-soft text-uva-accent-text">
                    <BookOpen className="size-[18px]" strokeWidth={2.1} />
                  </div>
                  {/* Sin `truncate`: el título se ve completo aunque
                      ocupe varias líneas al achicar la ventana, en vez de
                      cortarse con "…" (pedido explícito, no es un ancho
                      fijo el que decide qué tanto se ve). */}
                  <div className="min-w-0 flex-1">
                    <h2
                      id={`notas-curso-${idCurso}`}
                      className="m-0 break-words font-heading text-[17px] leading-snug text-uva-text"
                    >
                      {grupo.curso?.titulo ?? "Otras notas"}
                    </h2>
                    <p className="m-0 text-[12px] text-uva-muted">
                      {totalNotasCurso} {totalNotasCurso === 1 ? "nota" : "notas"}
                    </p>
                  </div>
                  <ChevronDown
                    className={`size-4 shrink-0 text-uva-muted transition-transform ${cursoColapsado ? "" : "rotate-180"}`}
                    strokeWidth={2.2}
                    aria-hidden
                  />
                </button>
                {grupo.curso?.tieneAcceso && (
                  <Link
                    href={`/cursos/${grupo.curso.slug}`}
                    className="inline-flex shrink-0 items-center gap-1 self-start pl-12 text-[12.5px] text-uva-accent-text sm:pl-0"
                  >
                    Ir al curso
                    <ArrowRight className="size-3.5" strokeWidth={2.2} />
                  </Link>
                )}
              </div>

              {!cursoColapsado && (
                <div id={`notas-curso-contenido-${idCurso}`} className="flex flex-col gap-4">
                  {grupo.curso && !grupo.curso.tieneAcceso && (
                    <div className="flex flex-wrap items-center gap-2 rounded-uva-md bg-[#27272A] px-3.5 py-2.5 text-[13px] text-uva-muted">
                      <Lock className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />
                      <span className="flex-1">
                        Tu acceso a este curso terminó. Renueva para volver a ver las clases.
                      </span>
                      <Link href="/dashboard/planes" className="font-semibold text-uva-accent-text">
                        Ver planes
                      </Link>
                    </div>
                  )}
                  {!grupo.curso && (
                    <p className="m-0 text-[13px] text-uva-muted">
                      La clase de estas notas ya no está disponible. Puedes leerlas, editarlas o eliminarlas.
                    </p>
                  )}

                  {grupo.lecciones.map(({ leccionId, leccion, notas: notasLeccion }) => {
                    const leccionColapsada = colapsados.has(leccionId);
                    return (
                      <div key={leccionId} className="flex flex-col gap-2">
                        {/* Cabecera de la clase: separa visualmente sus
                            notas de las de otra clase del mismo curso,
                            aunque compartan tarjeta. También colapsa solo
                            esa clase, sin afectar las demás. */}
                        {leccion ? (
                          <button
                            type="button"
                            onClick={() => alternar(leccionId)}
                            aria-expanded={!leccionColapsada}
                            aria-controls={`notas-leccion-contenido-${leccionId}`}
                            className="flex cursor-pointer items-start gap-2 rounded-uva-md border-0 bg-[#27272A] px-3 py-2 text-left"
                          >
                            <PlayCircle
                              className="mt-0.5 size-3.5 shrink-0 text-uva-muted"
                              strokeWidth={2.2}
                              aria-hidden
                            />
                            {/* Sin `truncate`: el título de la clase se ve
                                completo aunque ocupe varias líneas, en vez
                                de cortarse con "…". */}
                            <span className="min-w-0 flex-1 break-words text-[12.5px] font-semibold leading-snug text-uva-text">
                              {leccion.titulo}
                            </span>
                            <span className="mt-0.5 shrink-0 font-mono text-[10px] text-uva-muted">
                              {notasLeccion.length}
                            </span>
                            <ChevronDown
                              className={`mt-0.5 size-3.5 shrink-0 text-uva-muted transition-transform ${leccionColapsada ? "" : "rotate-180"}`}
                              strokeWidth={2.2}
                              aria-hidden
                            />
                          </button>
                        ) : null}
                        {!leccionColapsada && (
                          <ul
                            id={`notas-leccion-contenido-${leccionId}`}
                            className="m-0 ml-2.5 flex list-none flex-col divide-y divide-uva-divider border-l-2 border-uva-divider py-0 pl-3.5"
                          >
                            {notasLeccion.map((nota) => (
                              <li key={nota.id} className="min-w-0 py-3 first:pt-0 last:pb-0">
                                <NotaItem
                                  nota={nota}
                                  salto={
                                    grupo.curso?.tieneAcceso && leccion
                                      ? { href: `/cursos/${grupo.curso.slug}/${leccion.slug}?t=${nota.segundo}` }
                                      : null
                                  }
                                  onCambiarNotas={setNotas}
                                  onAviso={setAviso}
                                  onEliminada={() => tituloRef.current?.focus()}
                                />
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
