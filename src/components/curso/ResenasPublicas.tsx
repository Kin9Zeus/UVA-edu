"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstrellasCalificacion } from "@/components/curso/EstrellasCalificacion";
import { cargarMasCalificacionesCurso } from "@/actions/cursos/calificaciones";
import type { CalificacionesCurso } from "@/lib/curso-calificaciones";
import {
  agregarTanda,
  desdeSiguienteTanda,
  quedanMasReseñas,
  reseñasVisibles,
  type ReseñasAdicionales,
} from "@/lib/curso-calificaciones-tandas";

/** "4,7": coma decimal y siempre un decimal, como se lee en español. */
const formatPromedio = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
}).format;

/** Sin `ocultas`: un visitante no modera, así que no hay nada que esconder en esta visita. */
const SIN_OCULTAS: ReadonlySet<string> = new Set();

/**
 * Reseñas del curso para un visitante sin sesión (ficha pública, dirección
 * visual "Maqueta").
 *
 * Solo lectura: no hay formulario para calificar (pide sesión y acceso al
 * curso) ni botón de "me gusta" (pide sesión). El número de "me gusta" se
 * muestra como texto, no como botón: un control que no responde confunde
 * más que no tenerlo.
 *
 * "Ver más reseñas" funciona igual que en la ficha con sesión, con las mismas
 * funciones de `curso-calificaciones-tandas`.
 */
export function ResenasPublicas({
  cursoId,
  cursoSlug,
  datos,
}: {
  cursoId: string;
  cursoSlug: string;
  datos: CalificacionesCurso;
}) {
  const [cargando, startTransition] = useTransition();
  const [errorCargar, setErrorCargar] = useState<string | null>(null);
  const [adicionales, setAdicionales] = useState<ReseñasAdicionales>(null);

  const reseñas = reseñasVisibles(datos.reseñas, adicionales, SIN_OCULTAS);
  const hayMas = quedanMasReseñas(datos.hayMas, adicionales);

  function cargarMas() {
    setErrorCargar(null);
    const desde = desdeSiguienteTanda(datos.reseñas, adicionales);
    startTransition(async () => {
      const resultado = await cargarMasCalificacionesCurso(cursoId, desde);
      if ("error" in resultado) {
        setErrorCargar(resultado.error);
        return;
      }
      setAdicionales((actuales) => agregarTanda(actuales, resultado));
    });
  }

  return (
    <section
      id="reseñas"
      aria-labelledby="reseñas-titulo"
      className="flex scroll-mt-6 flex-col gap-5 border-t border-uva-divider pt-10"
    >
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5">
        <h2 id="reseñas-titulo" className="m-0 text-uva-titulo-4 text-uva-text">
          Reseñas
        </h2>
        {/* `promedio` llega null por debajo del mínimo de reseñas: con pocas
            opiniones la cifra no dice nada, así que solo se cuenta cuántas hay. */}
        {datos.promedio !== null ? (
          <>
            <EstrellasCalificacion puntuacion={datos.promedio} size={16} />
            <p className="m-0 font-mono text-uva-detalle text-uva-text-muted">
              <b className="text-uva-text">{formatPromedio(datos.promedio)}</b>{" "}
              de 5 con {datos.total}{" "}
              {datos.total === 1 ? "opinión" : "opiniones"}
            </p>
          </>
        ) : (
          datos.total > 0 && (
            <p className="m-0 font-mono text-uva-detalle text-uva-text-muted">
              {datos.total} {datos.total === 1 ? "opinión" : "opiniones"}
            </p>
          )
        )}
      </div>

      <p className="m-0 text-uva-detalle text-uva-text-muted">
        ¿Ya hiciste este curso?{" "}
        <Link
          href={`/login?redirect=/cursos/${cursoSlug}`}
          className="inline-flex min-h-11 items-center font-semibold text-uva-accent-ink underline underline-offset-4 hover:no-underline"
        >
          Entra para dejar tu reseña
        </Link>
      </p>

      {reseñas.length === 0 ? (
        <p className="m-0 text-uva-cuerpo text-uva-text-muted">
          Todavía no hay reseñas de este curso.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reseñas.map((reseña) => (
            <li key={reseña.id}>
              <article className="flex h-full flex-col gap-2 rounded-uva-md border border-uva-divider bg-uva-surface p-4">
                <p className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <b className="min-w-0 truncate text-uva-cuerpo text-uva-text">
                    {reseña.autorNombre}
                  </b>
                  <EstrellasCalificacion
                    puntuacion={reseña.puntuacion}
                    size={14}
                  />
                  <span className="text-uva-detalle text-uva-text-muted">
                    {reseña.tiempo}
                  </span>
                </p>
                {reseña.comentario && (
                  <p className="m-0 text-uva-cuerpo break-words text-uva-text">
                    {reseña.comentario}
                  </p>
                )}
                {reseña.totalMeGusta > 0 && (
                  <p className="m-0 mt-auto inline-flex items-center gap-1.5 pt-1 font-mono text-uva-detalle text-uva-text-muted">
                    <Heart className="size-3.5" strokeWidth={2} aria-hidden />
                    {reseña.totalMeGusta} me gusta
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}

      {hayMas && (
        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="uva-secondary"
            size="uva"
            className="min-h-12 w-fit text-uva-cuerpo"
            disabled={cargando}
            onClick={cargarMas}
          >
            {cargando ? "Cargando…" : "Ver más reseñas"}
          </Button>
          {errorCargar && (
            <p
              role="alert"
              className="m-0 text-uva-detalle text-uva-error-text"
            >
              {errorCargar}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
