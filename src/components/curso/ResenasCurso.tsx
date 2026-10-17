"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EstrellasCalificacion, EstrellasInput } from "@/components/curso/EstrellasCalificacion";
import {
  calificarCurso,
  cargarMasCalificacionesCurso,
  eliminarCalificacionPropia,
  moderarCalificacion,
  quitarReaccionCalificacion,
  reaccionarCalificacion,
} from "@/actions/cursos/calificaciones";
import type { CalificacionesCurso } from "@/lib/curso-calificaciones";
import {
  agregarTanda,
  desdeSiguienteTanda,
  quedanMasReseñas,
  reseñasVisibles,
  type ReseñasAdicionales,
} from "@/lib/curso-calificaciones-tandas";
import { cn } from "@/lib/utils";

/** "4,7": coma decimal y siempre un decimal, como se lee en español. */
const formatPromedio = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
}).format;

/** Quién lee: sin esto (visitante sin sesión) las reseñas son de solo lectura. */
export type SesionResenas = {
  usuarioActualId: string;
  /** Con acceso al curso: mismo umbral que comentar una clase. */
  puedeCalificar: boolean;
  esAdmin: boolean;
};

/**
 * Reseñas de un curso con la dirección visual «Maqueta» (artboard "Curso").
 *
 * - Sin sesión: solo lectura, con "Entra para dejar tu reseña". El número de
 *   "me gusta" va como texto: un control que no responde confunde más que no
 *   tenerlo.
 * - Con sesión: "me gusta"; con acceso, escribir o editar la reseña propia
 *   (una por persona, `calificarCurso` hace upsert) y borrarla; el
 *   administrador puede retirar las de otros.
 *
 * "Ver más reseñas" trae tandas con `curso-calificaciones-tandas`; se
 * conservan si la página se refresca (dar "me gusta" o calificar hace
 * router.refresh), para que la lista no salte hacia arriba.
 */
export function ResenasCurso({
  cursoId,
  cursoSlug,
  datos,
  sesion,
}: {
  cursoId: string;
  cursoSlug: string;
  datos: CalificacionesCurso;
  sesion: SesionResenas | null;
}) {
  const router = useRouter();
  const [cargando, startCargar] = useTransition();
  const [errorCargar, setErrorCargar] = useState<string | null>(null);
  const [adicionales, setAdicionales] = useState<ReseñasAdicionales>(null);
  /** Retiradas por el administrador en esta visita: una reseña de una tanda
   * adicional no desaparece con router.refresh (solo se pide la primera). */
  const [ocultas, setOcultas] = useState<ReadonlySet<string>>(new Set());
  const [pendienteModerar, startModerar] = useTransition();
  const [errorModerar, setErrorModerar] = useState<string | null>(null);

  const reseñas = reseñasVisibles(datos.reseñas, adicionales, ocultas);
  const hayMas = quedanMasReseñas(datos.hayMas, adicionales);

  function cargarMas() {
    setErrorCargar(null);
    const desde = desdeSiguienteTanda(datos.reseñas, adicionales);
    startCargar(async () => {
      const resultado = await cargarMasCalificacionesCurso(cursoId, desde);
      if ("error" in resultado) {
        setErrorCargar(resultado.error);
        return;
      }
      setAdicionales((actuales) => agregarTanda(actuales, resultado));
    });
  }

  function moderar(calificacionId: string) {
    setErrorModerar(null);
    startModerar(async () => {
      const resultado = await moderarCalificacion(calificacionId);
      if ("error" in resultado) {
        setErrorModerar(resultado.error);
        return;
      }
      setOcultas((actuales) => new Set(actuales).add(calificacionId));
      router.refresh();
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
              <b className="text-uva-text">{formatPromedio(datos.promedio)}</b> de 5 con {datos.total}{" "}
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

      {!sesion ? (
        <p className="m-0 text-uva-detalle text-uva-text-muted">
          ¿Ya hiciste este curso?{" "}
          <Link
            href={`/login?redirect=/cursos/${cursoSlug}`}
            className="inline-flex min-h-11 items-center font-semibold text-uva-accent-ink underline underline-offset-4 hover:no-underline"
          >
            Entra para dejar tu reseña
          </Link>
        </p>
      ) : (
        sesion.puedeCalificar && (
          // `key` remonta el formulario cuando pasa de "sin reseña" a "con
          // reseña": el estado se reinicia desde lo que el servidor guardó.
          <FormularioResena
            key={datos.miCalificacion?.id ?? "nueva"}
            cursoId={cursoId}
            miCalificacion={datos.miCalificacion}
          />
        )
      )}

      {errorModerar && (
        <p role="alert" className="m-0 text-uva-detalle text-uva-error-text">
          {errorModerar}
        </p>
      )}

      {reseñas.length === 0 ? (
        <p className="m-0 text-uva-cuerpo text-uva-text-muted">Todavía no hay reseñas de este curso.</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2 lg:grid-cols-3">
          {reseñas.map((reseña) => (
            <li key={reseña.id}>
              <article className="flex h-full flex-col gap-2 rounded-uva-md border border-uva-divider bg-uva-surface p-4">
                <p className="m-0 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <b className="min-w-0 truncate text-uva-cuerpo text-uva-text">{reseña.autorNombre}</b>
                  <EstrellasCalificacion puntuacion={reseña.puntuacion} size={14} />
                  <span className="text-uva-detalle text-uva-text-muted">{reseña.tiempo}</span>
                </p>
                {reseña.comentario && (
                  <p className="m-0 text-uva-cuerpo break-words text-uva-text">{reseña.comentario}</p>
                )}
                <div className="mt-auto flex flex-wrap items-center gap-x-3 pt-1">
                  {sesion ? (
                    <BotonMeGusta
                      calificacionId={reseña.id}
                      meGusta={reseña.meGusta}
                      total={reseña.totalMeGusta}
                    />
                  ) : (
                    reseña.totalMeGusta > 0 && (
                      <p className="m-0 inline-flex items-center gap-1.5 font-mono text-uva-detalle text-uva-text-muted">
                        <Heart className="size-3.5" strokeWidth={2} aria-hidden />
                        {reseña.totalMeGusta} me gusta
                      </p>
                    )
                  )}
                  {sesion?.esAdmin && reseña.autorId !== sesion.usuarioActualId && (
                    <button
                      type="button"
                      disabled={pendienteModerar}
                      onClick={() => moderar(reseña.id)}
                      className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-uva-detalle font-semibold text-uva-text-muted hover:text-uva-error-text disabled:cursor-not-allowed"
                    >
                      Retirar reseña
                    </button>
                  )}
                </div>
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
            <p role="alert" className="m-0 text-uva-detalle text-uva-error-text">
              {errorCargar}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function BotonMeGusta({
  calificacionId,
  meGusta: meGustaInicial,
  total: totalInicial,
}: {
  calificacionId: string;
  meGusta: boolean;
  total: number;
}) {
  const router = useRouter();
  const [optimista, setOptimista] = useState<{ meGusta: boolean; total: number } | null>(null);
  const [pendiente, startTransition] = useTransition();
  const meGusta = optimista?.meGusta ?? meGustaInicial;
  const total = optimista?.total ?? totalInicial;

  function alternar() {
    const siguiente = { meGusta: !meGusta, total: meGusta ? total - 1 : total + 1 };
    setOptimista(siguiente);
    startTransition(async () => {
      const accion = siguiente.meGusta ? reaccionarCalificacion : quitarReaccionCalificacion;
      const resultado = await accion(calificacionId);
      if ("error" in resultado) {
        setOptimista({ meGusta, total });
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={alternar}
      aria-pressed={meGusta}
      aria-label={`Me gusta, ${total}`}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 font-mono text-uva-detalle font-semibold disabled:cursor-not-allowed",
        meGusta ? "text-uva-accent-ink" : "text-uva-text-muted hover:text-uva-text",
      )}
    >
      <Heart className="size-4" strokeWidth={2.2} fill={meGusta ? "currentColor" : "none"} aria-hidden />
      {total}
    </button>
  );
}

/** Crear o editar la reseña propia, precargada si ya existe. */
function FormularioResena({
  cursoId,
  miCalificacion,
}: {
  cursoId: string;
  miCalificacion: CalificacionesCurso["miCalificacion"];
}) {
  const router = useRouter();
  const [puntuacion, setPuntuacion] = useState(miCalificacion?.puntuacion ?? 0);
  const [comentario, setComentario] = useState(miCalificacion?.comentario ?? "");
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function publicar() {
    if (puntuacion < 1) {
      setError("Elige una calificación de 1 a 5 estrellas.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const resultado = await calificarCurso(cursoId, puntuacion, comentario);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  }

  function eliminar() {
    if (!miCalificacion) return;
    startTransition(async () => {
      const resultado = await eliminarCalificacionPropia(miCalificacion.id);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setPuntuacion(0);
      setComentario("");
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-4.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="m-0 text-uva-cuerpo font-bold text-uva-text">
          {miCalificacion ? "Tu reseña" : "¿Qué te pareció este curso?"}
        </p>
        <EstrellasInput valor={puntuacion} onCambiar={setPuntuacion} disabled={pendiente} />
      </div>
      <label htmlFor="resena-comentario" className="sr-only">
        Tu reseña
      </label>
      <textarea
        id="resena-comentario"
        value={comentario}
        onChange={(evento) => setComentario(evento.target.value)}
        placeholder="Cuéntale a otros estudiantes qué aprendiste (opcional)"
        maxLength={1000}
        disabled={pendiente}
        rows={3}
        className="w-full resize-y rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface px-3.5 py-3 text-base text-uva-text placeholder:text-uva-text-muted focus:border-uva-accent focus:outline-none"
      />
      {error && (
        <p role="alert" className="m-0 text-uva-detalle text-uva-error-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={publicar}
          disabled={pendiente}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-uva-md border-0 bg-uva-btn px-5 text-uva-detalle font-semibold text-uva-on-accent hover:bg-uva-btn-hover disabled:cursor-not-allowed disabled:opacity-70"
        >
          {pendiente && <Loader2 className="size-4 animate-spin" strokeWidth={2.5} aria-hidden />}
          {pendiente ? "Publicando…" : miCalificacion ? "Guardar cambios" : "Publicar"}
        </button>
        {miCalificacion && (
          <button
            type="button"
            onClick={eliminar}
            disabled={pendiente}
            className="inline-flex min-h-11 cursor-pointer items-center border-0 bg-transparent p-0 text-uva-detalle font-semibold text-uva-text-muted hover:text-uva-error-text disabled:cursor-not-allowed"
          >
            Eliminar mi reseña
          </button>
        )}
      </div>
    </div>
  );
}
