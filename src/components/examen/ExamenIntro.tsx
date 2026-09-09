import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Lock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { IniciarExamenButton } from "@/components/examen/IniciarExamenButton";
import { COOLDOWN_REINTENTO_MINUTOS } from "@/lib/examenes/tipos";
import type { ResultadoIntentoVista, SituacionExamen } from "@/lib/examen";

/**
 * Todo lo que el estudiante ve del examen cuando NO está rindiéndolo: la
 * pantalla previa, el resultado del último intento, el bloqueo por lecciones
 * pendientes, la espera entre intentos y el estado final aprobado.
 *
 * Es un Server Component: nada de esto necesita interactividad salvo el botón
 * de iniciar, que sí es cliente.
 */
export function ExamenIntro({
  situacion,
  resultado,
  cursoId,
  cursoSlug,
  cursoTitulo,
  tiempoAgotado,
}: {
  situacion: Exclude<SituacionExamen, { situacion: "SIN_EXAMEN" } | { situacion: "EN_CURSO" }>;
  /** Resultado del último intento cerrado, si hay uno que mostrar. */
  resultado: ResultadoIntentoVista | null;
  cursoId: string;
  cursoSlug: string;
  cursoTitulo: string;
  /** El intento se cerró solo porque se acabó el tiempo, no porque el
   * estudiante lo enviara. Cambia el encabezado del resultado. */
  tiempoAgotado: boolean;
}) {
  const { examen } = situacion;

  return (
    <div className="mx-auto flex w-full max-w-[680px] flex-col gap-6 px-4 py-8 sm:px-6">
      <Link
        href={`/cursos/${cursoSlug}`}
        className="flex w-fit items-center gap-1.5 text-sm text-uva-muted-2 hover:text-uva-text"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Volver al curso
      </Link>

      <header className="flex flex-col gap-2">
        <p className="text-[13px] text-uva-muted">{cursoTitulo}</p>
        <h1 className="font-heading text-[26px] font-bold tracking-[-0.02em] text-uva-text">
          {examen.titulo}
        </h1>
      </header>

      {resultado && (
        <ResultadoBloque
          resultado={resultado}
          tiempoAgotado={tiempoAgotado}
          aprobado={situacion.situacion === "APROBADO"}
        />
      )}

      {situacion.situacion === "APROBADO" ? (
        <section className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <p className="flex items-center gap-2 font-heading text-[16.5px] font-bold text-uva-text">
            <CheckCircle2 className="size-5 text-uva-success" aria-hidden />
            Curso completado
          </p>
          <p className="text-[13.5px] leading-relaxed text-uva-muted">
            Aprobaste el examen final. Tu certificado ya está disponible.
          </p>
          <Button variant="primary" size="sm" className="w-fit" render={<Link href="/dashboard/certificados" />}>
            Ver mi certificado
          </Button>
        </section>
      ) : situacion.situacion === "BLOQUEADO" ? (
        <section className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <p className="flex items-center gap-2 font-heading text-[16.5px] font-bold text-uva-text">
            <Lock className="size-5 text-uva-muted" aria-hidden />
            Todavía no puedes presentarlo
          </p>
          <p className="text-[13.5px] leading-relaxed text-uva-muted">
            El examen final se habilita cuando termines todas las clases del curso.
          </p>
          <Button variant="primary" size="sm" className="w-fit" render={<Link href={`/cursos/${cursoSlug}`} />}>
            Volver al temario
          </Button>
        </section>
      ) : situacion.situacion === "EN_ESPERA" ? (
        <section className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <p className="flex items-center gap-2 font-heading text-[16.5px] font-bold text-uva-text">
            {situacion.esperaLarga ? (
              <XCircle className="size-5 text-uva-error" aria-hidden />
            ) : (
              <Clock className="size-5 text-uva-warn" aria-hidden />
            )}
            {situacion.esperaLarga ? "Agotaste tus intentos por ahora" : "Puedes reintentarlo más tarde"}
          </p>
          <p className="text-[13.5px] leading-relaxed text-uva-muted">
            {situacion.esperaLarga ? (
              <>
                Presentaste el examen {situacion.intentosUsados}{" "}
                {situacion.intentosUsados === 1 ? "vez" : "veces"} sin alcanzar el{" "}
                {examen.notaAprobatoria}% necesario.
              </>
            ) : (
              <>Entre un intento y otro hay una espera de {COOLDOWN_REINTENTO_MINUTOS} minutos.</>
            )}{" "}
            Vuelve a partir de las{" "}
            <time dateTime={situacion.disponibleDesde} className="font-mono text-uva-text">
              {new Date(situacion.disponibleDesde).toLocaleTimeString("es-CO", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Bogota",
              })}
            </time>{" "}
            {situacion.esperaLarga
              ? "y tendrás una tanda nueva de intentos. Aprovecha para repasar las clases del curso."
              : "para tu siguiente intento. Aprovecha para repasar las clases del curso."}
          </p>
          <Button variant="default" size="sm" className="w-fit" render={<Link href={`/cursos/${cursoSlug}`} />}>
            Repasar el curso
          </Button>
        </section>
      ) : (
        <section className="flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <div className="flex flex-col gap-2">
            <p className="font-heading text-[16.5px] font-bold text-uva-text">
              {situacion.intentosUsados > 0 ? "Vuelve a intentarlo" : "Antes de empezar"}
            </p>
            {examen.instrucciones ? (
              <RichTextRenderer contenido={examen.instrucciones} />
            ) : (
              <p className="text-[13.5px] leading-relaxed text-uva-muted">
                Responde todas las preguntas y envía el examen cuando termines.
              </p>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-3 border-t border-uva-divider pt-4 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-uva-text-faint">Para aprobar</dt>
              <dd className="mt-0.5 font-mono text-uva-text">{examen.notaAprobatoria}%</dd>
            </div>
            <div>
              <dt className="text-uva-text-faint">Tiempo</dt>
              <dd className="mt-0.5 font-mono text-uva-text">
                {examen.minutosLimite === null ? "Sin límite" : `${examen.minutosLimite} min`}
              </dd>
            </div>
            <div>
              <dt className="text-uva-text-faint">Intentos</dt>
              <dd className="mt-0.5 font-mono text-uva-text">
                {situacion.intentosRestantes === null
                  ? "Sin límite"
                  : `${situacion.intentosRestantes} ${situacion.intentosRestantes === 1 ? "restante" : "restantes"}`}
              </dd>
            </div>
          </dl>

          {examen.minutosLimite !== null && (
            <p className="flex items-start gap-2 text-[13px] text-uva-muted">
              <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
              El cronómetro arranca al iniciar y no se detiene aunque cierres la página.
            </p>
          )}

          <IniciarExamenButton
            cursoId={cursoId}
            cursoSlug={cursoSlug}
            etiqueta={
              situacion.intentosUsados > 0 ? "Iniciar nuevo intento" : "Iniciar examen"
            }
          />
        </section>
      )}
    </div>
  );
}

/**
 * Resultado del último intento cerrado.
 *
 * Muestra el puntaje y CUÁLES preguntas se fallaron, pero nunca cuál era la
 * respuesta correcta: con intentos limitados, revelarla convertiría el
 * reintento en un trámite (docs/functional-spec.md Flujo 14).
 */
function ResultadoBloque({
  resultado,
  tiempoAgotado,
  aprobado,
}: {
  resultado: ResultadoIntentoVista;
  tiempoAgotado: boolean;
  aprobado: boolean;
}) {
  const falladas = resultado.preguntas.filter((pregunta) => !pregunta.acertada);

  return (
    <section
      className={`rounded-uva-md border p-5 ${
        aprobado ? "border-uva-success bg-uva-success-soft" : "border-uva-divider bg-uva-surface"
      }`}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-heading text-[16.5px] font-bold text-uva-text">
          {aprobado
            ? "¡Aprobaste!"
            : tiempoAgotado
              ? "Se acabó el tiempo"
              : "No alcanzaste la nota"}
        </p>
        <p className="font-mono text-[22px] font-bold text-uva-text">
          {resultado.puntajePct === null ? "—" : `${resultado.puntajePct}%`}
          <span className="ml-1.5 text-[12px] font-normal text-uva-text-faint">
            de {resultado.notaRequerida}% necesario
          </span>
        </p>
      </div>

      {tiempoAgotado && !aprobado && (
        <p className="mt-2 text-[13px] text-uva-muted">
          Se calificaron las respuestas que alcanzaste a guardar antes de que venciera el plazo.
        </p>
      )}

      {falladas.length > 0 && (
        <div className="mt-4 border-t border-uva-divider pt-4">
          <p className="text-[13px] font-semibold text-uva-text">
            {falladas.length === 1
              ? "Fallaste esta pregunta:"
              : `Fallaste estas ${falladas.length} preguntas:`}
          </p>
          <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4">
            {falladas.map((pregunta) => (
              <li key={pregunta.id} className="text-[13px] text-uva-muted">
                <RichTextRenderer contenido={pregunta.enunciado} className="[&_p]:!m-0" />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-uva-text-faint">
            Repasa esos temas en las clases del curso antes de volver a intentarlo.
          </p>
        </div>
      )}
    </section>
  );
}
