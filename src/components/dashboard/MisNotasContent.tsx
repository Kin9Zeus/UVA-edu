"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown, Lock, NotebookPen, PlayCircle, Search } from "lucide-react";
import { NotaItem, ordenarNotas } from "@/components/notas/NotaItem";
import type { CursoDeNotas, LeccionDeNota, MisNotas, NotaLeccion } from "@/lib/notas";
import { PRECIOS_HABILITADOS } from "@/lib/features";

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

/** Para comparar sin tildes ni mayúsculas ("modelado" encuentra "Modelado"). */
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const CLASE_ENLACE =
  "inline-flex min-h-11 items-center gap-1.5 text-uva-cuerpo font-bold whitespace-nowrap text-uva-accent-ink hover:underline hover:underline-offset-3";

export function MisNotasContent({
  notas: notasIniciales,
  lecciones,
  cursos,
  filtro = null,
}: MisNotas & {
  /** Solo las notas de este curso ("Mis notas del curso" en la ficha). */
  filtro?: { slug: string; titulo: string } | null;
}) {
  const [notas, setNotas] = useState(notasIniciales);
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
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

  const todos = agrupar(notas, lecciones, cursos);
  const grupos = filtro ? todos.filter((grupo) => grupo.curso?.slug === filtro.slug) : todos;
  // La búsqueda filtra por curso, en el navegador: las notas ya están todas
  // cargadas y son de una sola persona.
  const termino = normalizar(busqueda);
  const visibles = termino
    ? grupos.filter((grupo) => normalizar(grupo.curso?.titulo ?? "Otras notas").includes(termino))
    : grupos;
  const conteo = termino
    ? visibles.length === 1
      ? "1 curso coincide"
      : `${visibles.length} cursos coinciden`
    : grupos.length === 1
      ? "1 curso con notas"
      : `${grupos.length} cursos con notas`;

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-[22px] px-uva-margen py-7 lg:gap-7 lg:py-9">
      <div>
        <h1 ref={tituloRef} tabIndex={-1} className="text-uva-titulo-3 text-uva-text outline-none">
          Mis notas
        </h1>
        <p className="mt-2 text-uva-lead text-uva-text-muted">
          {filtro
            ? `Tus apuntes de ${filtro.titulo}, en el minuto exacto del video. Solo tú puedes verlos.`
            : "Tus apuntes de todas las clases, en el minuto exacto del video. Solo tú puedes verlos."}
        </p>
        {filtro && (
          <Link
            href="/dashboard/notas"
            className="mt-1 inline-flex min-h-11 w-fit items-center text-uva-cuerpo font-bold text-uva-accent-ink underline underline-offset-4 hover:no-underline"
          >
            Ver las notas de todos mis cursos
          </Link>
        )}
      </div>

      {/* Anuncios para lectores de pantalla (WCAG 4.1.3). */}
      <p aria-live="polite" className="sr-only">
        {aviso}
      </p>

      {grupos.length > 0 && !filtro && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <label className="relative block w-full sm:w-[420px]">
            <span className="sr-only">Buscar en tus notas por curso</span>
            <Search className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-uva-text-muted" aria-hidden />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Busca un curso en tus notas"
              className="h-12 w-full rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface pr-3.5 pl-11 text-base text-uva-text placeholder:text-uva-text-muted"
            />
          </label>
          <p aria-live="polite" className="m-0 text-uva-detalle text-uva-text-muted">
            {conteo}
          </p>
        </div>
      )}

      <div className="@container grid gap-7 lg:gap-9">
        {grupos.length === 0 ? (
          <div className="grid justify-items-center gap-3.5 rounded-uva-lg border border-uva-divider bg-uva-surface px-5 py-12 text-center">
            <NotebookPen className="size-7 text-uva-text-muted" strokeWidth={1.8} aria-hidden />
            <p className="m-0 max-w-[44ch] text-uva-cuerpo text-uva-text-muted">
              {filtro ? "Aún no tienes notas en este curso." : "Aún no tienes notas."} Mientras ves una clase,
              abre la pestaña Notas para guardar un apunte en el minuto exacto.
            </p>
          </div>
        ) : visibles.length === 0 ? (
          <div className="grid justify-items-center gap-3.5 rounded-uva-lg border border-uva-divider bg-uva-surface px-5 py-12 text-center">
            <Search className="size-7 text-uva-text-muted" strokeWidth={1.8} aria-hidden />
            <p className="m-0 max-w-[44ch] text-uva-cuerpo break-words text-uva-text-muted">
              No tienes notas en un curso que coincida con «{busqueda.trim()}». Revisa cómo lo escribiste o
              busca otro curso.
            </p>
          </div>
        ) : (
          visibles.map((grupo) => {
            const idCurso = grupo.cursoId ?? "sin-curso";
            const totalNotasCurso = grupo.lecciones.reduce((total, l) => total + l.notas.length, 0);
            const cursoColapsado = colapsados.has(idCurso);
            return (
              <section
                key={idCurso}
                aria-labelledby={`notas-curso-${idCurso}`}
                className="grid gap-[18px] border-t border-uva-divider pt-4"
              >
                {/* Cabecera del curso: el título también es el botón que
                    oculta o vuelve a mostrar sus notas. Sin `truncate`: el
                    título se ve completo aunque ocupe varias líneas. */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <h2 id={`notas-curso-${idCurso}`} className="m-0 min-w-[min(100%,16rem)] flex-1">
                    <button
                      type="button"
                      onClick={() => alternar(idCurso)}
                      aria-expanded={!cursoColapsado}
                      aria-controls={`notas-curso-contenido-${idCurso}`}
                      className="flex min-h-14 w-full cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-uva-titulo-4 font-extrabold break-words text-uva-text">
                          {grupo.curso?.titulo ?? "Otras notas"}
                        </span>
                        <span className="block text-uva-detalle font-normal text-uva-text-muted">
                          {totalNotasCurso} {totalNotasCurso === 1 ? "nota" : "notas"}
                        </span>
                      </span>
                      <ChevronDown
                        className={`size-5 shrink-0 text-uva-text-muted transition-transform motion-reduce:transition-none ${cursoColapsado ? "-rotate-90" : ""}`}
                        strokeWidth={1.8}
                        aria-hidden
                      />
                    </button>
                  </h2>
                  {grupo.curso?.tieneAcceso && (
                    <Link href={`/cursos/${grupo.curso.slug}`} className={CLASE_ENLACE}>
                      Ir al curso
                      <ArrowRight className="size-4" strokeWidth={1.8} aria-hidden />
                    </Link>
                  )}
                </div>

                {!cursoColapsado && (
                  <div id={`notas-curso-contenido-${idCurso}`} className="grid gap-[18px]">
                    {grupo.curso && !grupo.curso.tieneAcceso && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-uva-md bg-uva-surface-2 px-3.5 py-2 text-uva-cuerpo text-uva-text-muted">
                        <Lock className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
                        <span className="min-w-[200px] flex-1">
                          {PRECIOS_HABILITADOS
                            ? "Tu acceso a este curso terminó. Renueva para volver a ver las clases."
                            : "Tu acceso a este curso terminó. Canjea un código para volver a ver las clases."}
                        </span>
                        <Link
                          href={PRECIOS_HABILITADOS ? "/dashboard/planes" : "/dashboard/suscripcion"}
                          className={CLASE_ENLACE}
                        >
                          {PRECIOS_HABILITADOS ? "Ver planes" : "Canjear un código"}
                        </Link>
                      </div>
                    )}
                    {!grupo.curso && (
                      <p className="m-0 text-uva-detalle text-uva-text-muted">
                        La clase de estas notas ya no está disponible. Puedes leerlas, editarlas o eliminarlas.
                      </p>
                    )}

                    {grupo.lecciones.map(({ leccionId, leccion, notas: notasLeccion }) => {
                      const leccionColapsada = colapsados.has(leccionId);
                      return (
                        <div key={leccionId} className="grid gap-1">
                          {/* Cabecera de la clase: separa sus notas de las de
                              otra clase del mismo curso y colapsa solo esa. */}
                          {leccion ? (
                            <h3 className="m-0">
                              <button
                                type="button"
                                onClick={() => alternar(leccionId)}
                                aria-expanded={!leccionColapsada}
                                aria-controls={`notas-leccion-contenido-${leccionId}`}
                                className="flex min-h-11 w-full cursor-pointer items-center gap-2 border-0 bg-transparent p-0 text-left text-uva-cuerpo font-bold text-uva-text-muted hover:text-uva-text"
                              >
                                <PlayCircle className="size-4 shrink-0" strokeWidth={1.8} aria-hidden />
                                <span className="min-w-0 break-words">
                                  {leccion.titulo}{" "}
                                  <span className="text-uva-detalle font-medium whitespace-nowrap">
                                    {notasLeccion.length} {notasLeccion.length === 1 ? "nota" : "notas"}
                                  </span>
                                </span>
                                <ChevronDown
                                  className={`ml-auto size-4 shrink-0 transition-transform motion-reduce:transition-none ${leccionColapsada ? "-rotate-90" : ""}`}
                                  strokeWidth={1.8}
                                  aria-hidden
                                />
                              </button>
                            </h3>
                          ) : null}
                          {!leccionColapsada && (
                            <ul
                              id={`notas-leccion-contenido-${leccionId}`}
                              className="m-0 ml-[7px] list-none divide-y divide-uva-divider border-l-2 border-uva-divider p-0"
                            >
                              {notasLeccion.map((nota) => (
                                <li key={nota.id} className="min-w-0 py-3 pl-[18px]">
                                  <NotaItem
                                    nota={nota}
                                    cuaderno
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
    </div>
  );
}
