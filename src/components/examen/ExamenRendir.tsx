"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, Grape, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { PreguntaEmparejar } from "@/components/examen/PreguntaEmparejar";
import { enviarIntento, responderPregunta } from "@/actions/examenes/intento";
import type { IntentoEnCurso } from "@/lib/examen";
import { VIDAS_INICIALES } from "@/lib/examenes/tipos";
import type { PreguntaParaEstudiante, RespuestaEstudiante } from "@/lib/examenes/tipos";

function formatearRestante(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

function valorVacioPara(pregunta: PreguntaParaEstudiante): RespuestaEstudiante {
  if (pregunta.tipo === "OPCION_MULTIPLE") return [];
  if (pregunta.tipo === "EMPAREJAR") return {};
  return "";
}

type Feedback = {
  acierto: boolean;
  cerrado: boolean;
  porTiempo: boolean;
  /** Qué pregunta toca al pulsar "Siguiente" — lo decide el servidor, no
   * este componente (la cola de reintentos no es un orden lineal). Se guarda
   * acá y se aplica en `siguiente()` para no cambiarle la pregunta debajo
   * mientras todavía está leyendo el feedback de la anterior. */
  siguientePreguntaId?: string;
};

/**
 * Pantalla de rendición del examen — una pregunta a la vez, estilo juego
 * (corazones, contador de correctas, feedback inmediato) sin perder la
 * estética U.V.A.
 *
 * Cada respuesta se califica y persiste al confirmarla (`responderPregunta`)
 * y queda fija: no hay vuelta atrás ni botón "Enviar examen". Fallar no saca
 * la pregunta del examen — vuelve a aparecer más adelante, después de las
 * demás pendientes— y cuesta una vida; el intento termina al responderlas
 * todas bien, agotar las vidas, o agotarse el tiempo.
 *
 * El orden lo manda el SERVIDOR (`preguntaActualId` al entrar,
 * `siguientePreguntaId` en cada respuesta): acá no se deduce, porque la cola
 * de pendientes se reordena con cada fallo. Nada de lo que se ve contiene
 * respuestas correctas: `preguntas` ya pasó por
 * `prepararPreguntasParaEstudiante()` en el servidor, y la calificación de
 * cada respuesta vuelve a decidirla el servidor, nunca este componente.
 */
export function ExamenRendir({
  intento,
  cursoSlug,
  cursoTitulo,
}: {
  intento: IntentoEnCurso;
  cursoSlug: string;
  cursoTitulo: string;
}) {
  const [preguntaActualId, setPreguntaActualId] = useState(intento.preguntaActualId);
  const [vidas, setVidas] = useState(intento.vidasRestantes);
  const [correctas, setCorrectas] = useState(intento.resueltas);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const router = useRouter();
  const encabezadoRef = useRef<HTMLHeadingElement>(null);
  const cerradoPorTiempoRef = useRef(false);

  const total = intento.preguntas.length;
  // `preguntas` trae TODAS las del examen y no cambia: lo que se mueve es
  // cuál id es la actual, así que se busca por id en vez de por índice.
  const preguntaActual = intento.preguntas.find((pregunta) => pregunta.id === preguntaActualId);

  // ---------------- Cronómetro ----------------
  // Único disparador que queda para cerrar el intento sin que el estudiante
  // termine todas las preguntas ni agote las vidas: se acabó el tiempo.
  useEffect(() => {
    if (!intento.expiraEn) return;
    const limite = new Date(intento.expiraEn).getTime();

    function tick() {
      const restante = Math.max(0, Math.round((limite - Date.now()) / 1000));
      setSegundosRestantes(restante);
      if (restante === 0 && !cerradoPorTiempoRef.current) {
        // Guard contra reintentos mientras la llamada está en vuelo (no
        // "para siempre": si el servidor rechaza porque el reloj del
        // navegador está adelantado, se libera abajo para reintentar en el
        // próximo tick, cuando el vencimiento real sí haya llegado).
        cerradoPorTiempoRef.current = true;
        void enviarIntento(intento.id).then((resultado) => {
          // El servidor valida `expira_en` de nuevo (nunca confía en que
          // este tick disparó justo a tiempo): si el reloj del navegador
          // está adelantado, todavía no hay nada que cerrar. Se libera el
          // guard para que el siguiente tick reintente cuando corresponda,
          // en vez de dejar el examen sin cronómetro por el resto del
          // intento.
          if ("error" in resultado && resultado.error === "El tiempo del examen todavía no se agotó.") {
            cerradoPorTiempoRef.current = false;
            return;
          }
          // Cualquier otro resultado (éxito, o "ya fue enviado" porque otra
          // vía —responderPregunta— cerró el intento primero) navega igual:
          // la pantalla de resultado se arma de nuevo con lo que quedó.
          router.replace(`/cursos/${cursoSlug}/examen?tiempo=agotado`);
          router.refresh();
        });
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [intento.expiraEn, intento.id, cursoSlug, router]);

  // ---------------- Foco al avanzar de pregunta ----------------
  useEffect(() => {
    encabezadoRef.current?.focus();
  }, [preguntaActualId]);

  // Inalcanzable en la práctica: el id sale siempre de la cola del intento y
  // `preguntas` es el examen congelado completo. Si se diera, no hay nada que
  // renderizar y recargar es lo único sensato — mejor que reventar.
  if (!preguntaActual) {
    return (
      <div className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6">
        <p role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
          No pudimos cargar la pregunta. Recarga la página para continuar tu examen.
        </p>
      </div>
    );
  }

  async function confirmar(valor: RespuestaEstudiante) {
    if (enviando || feedback) return;
    setEnviando(true);
    setError(null);

    const resultado = await responderPregunta(intento.id, preguntaActualId, valor);
    setEnviando(false);

    if ("error" in resultado) {
      setError(resultado.error);
      return;
    }

    setVidas(resultado.vidasRestantes);
    if (resultado.acierto) setCorrectas((c) => c + 1);
    setFeedback({
      acierto: resultado.acierto,
      cerrado: resultado.cerrado,
      porTiempo: resultado.porTiempo ?? false,
      siguientePreguntaId: resultado.siguientePreguntaId,
    });
  }

  function siguiente() {
    // El servidor ya dijo cuál sigue (puede ser una que se falló antes y
    // volvió al final de la cola). Sin dato, se queda donde está en vez de
    // adivinar un orden que no existe.
    if (feedback?.siguientePreguntaId) setPreguntaActualId(feedback.siguientePreguntaId);
    setFeedback(null);
  }

  function verResultado() {
    router.replace(`/cursos/${cursoSlug}/examen`);
    router.refresh();
  }

  const tiempoCritico = segundosRestantes !== null && segundosRestantes <= 60;

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 py-8 sm:px-6">
      {/* Barra sticky: corazones, correctas, progreso y tiempo tienen que
          seguir visibles durante todo el examen, no solo al bajar por una
          página larga (ya no la hay: es una pregunta a la vez). */}
      <div className="sticky top-0 z-10 -mx-4 flex flex-col gap-2.5 border-b border-uva-divider bg-uva-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 font-mono text-[12.5px] text-uva-muted" aria-live="polite">
            Correctas {correctas}/{total}
          </p>

          <div className="flex items-center gap-3">
            {/* Uvas, no corazones genéricos: referencia visual al nombre de
                la plataforma. Morado (`uva-grape`), no el magenta de acento
                — ese color es exclusivo de CTAs/progreso (CLAUDE.md §3.3),
                las vidas son un indicador aparte. */}
            <div className="flex items-center gap-1" role="status" aria-label={`${vidas} de ${VIDAS_INICIALES} vidas`}>
              {Array.from({ length: VIDAS_INICIALES }, (_, i) => (
                <Grape
                  key={i}
                  className={`size-4 ${i < vidas ? "fill-uva-grape text-uva-grape" : "text-uva-divider"}`}
                  aria-hidden
                />
              ))}
            </div>

            {segundosRestantes !== null && (
              <p
                className={`flex shrink-0 items-center gap-1.5 font-mono text-[13px] font-semibold ${
                  tiempoCritico ? "text-uva-error" : "text-uva-text"
                }`}
                aria-live={tiempoCritico ? "assertive" : "off"}
              >
                <Clock className="size-4" aria-hidden />
                <span className="sr-only">Tiempo restante: </span>
                {formatearRestante(segundosRestantes)}
              </p>
            )}
          </div>
        </div>

        {/* Progreso = resueltas correctamente, no "cuántas llevo vistas":
            con la cola de reintentos, avanzar de pregunta no es avanzar en el
            examen — solo acertar lo es. */}
        <Progress value={(correctas / total) * 100} className="[&_[data-slot=progress-track]]:h-1.5" />
      </div>

      <header className="flex flex-col gap-1">
        <p className="text-[13px] text-uva-muted">{cursoTitulo}</p>
        <h1
          ref={encabezadoRef}
          tabIndex={-1}
          className="font-heading text-[19px] font-bold tracking-[-0.02em] text-uva-text outline-none"
        >
          {/* Sin número de posición: el orden no es lineal, así que "Pregunta
              3 de 10" mentiría en cuanto el estudiante falle una. */}
          {total - correctas === 1 ? "Última pregunta" : `Te faltan ${total - correctas} preguntas`}
        </h1>
      </header>

      {error && (
        <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
          {error}
        </div>
      )}

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-4 sm:p-5">
        <RichTextRenderer contenido={preguntaActual.enunciado} className="[&_p]:!text-uva-text" />

        <div className="mt-4">
          <PreguntaCuerpo
            key={preguntaActual.id}
            pregunta={preguntaActual}
            disabled={enviando || feedback !== null}
            onConfirmar={confirmar}
          />
        </div>
      </div>

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2.5 rounded-uva-md border p-4 ${
            feedback.porTiempo
              ? "border-uva-divider bg-uva-surface-2"
              : feedback.acierto
                ? "border-uva-valid bg-uva-success-soft"
                : "border-uva-error bg-uva-error-soft"
          }`}
        >
          {feedback.porTiempo ? (
            <Clock className="mt-0.5 size-5 shrink-0 text-uva-text-faint" aria-hidden />
          ) : feedback.acierto ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-uva-success-text" aria-hidden />
          ) : (
            <XCircle className="mt-0.5 size-5 shrink-0 text-uva-error-text" aria-hidden />
          )}
          <div className="flex flex-1 flex-col gap-2.5">
            <p className="text-[13.5px] text-uva-text">
              {/* Si se cerró por tiempo, esta respuesta nunca se calificó —
                  nunca decir "Fallaste" de algo que no se evaluó. */}
              {feedback.porTiempo
                ? "Se acabó el tiempo."
                : feedback.acierto
                  ? "¡Correcto!"
                  : vidas === 0
                    ? "Fallaste. Se acabaron tus vidas por esta vez."
                    : "Fallaste. Esta pregunta volverá a aparecer más adelante."}
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              className="w-fit"
              onClick={feedback.cerrado ? verResultado : siguiente}
            >
              {feedback.cerrado ? "Ver resultado" : "Siguiente"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Cuerpo interactivo de UNA pregunta. Con `key={pregunta.id}` en el padre,
 * React la remonta entera al avanzar — el estado local (borrador) siempre
 * arranca limpio sin tener que resetearlo a mano.
 *
 * Atómicos (OPCION_UNICA, VERDADERO_FALSO): un solo gesto — tocar la opción —
 * ya significa "terminé", así que califican al instante. Compuestos
 * (OPCION_MULTIPLE, RELLENAR_ESPACIO, EMPAREJAR): necesitan un botón
 * explícito "Confirmar respuesta" porque construir la respuesta toma más de
 * un gesto.
 */
function PreguntaCuerpo({
  pregunta,
  disabled,
  onConfirmar,
}: {
  pregunta: PreguntaParaEstudiante;
  disabled: boolean;
  onConfirmar: (valor: RespuestaEstudiante) => void;
}) {
  const [borrador, setBorrador] = useState<RespuestaEstudiante>(() => valorVacioPara(pregunta));

  if (pregunta.tipo === "OPCION_UNICA" || pregunta.tipo === "VERDADERO_FALSO") {
    // Botones, no radios: tocar una opción confirma y califica al instante —
    // no hay un estado "marcado sin confirmar" que un contrato de
    // radio/checkbox pudiera describir honestamente.
    return (
      <div className="flex flex-col gap-2" role="group" aria-label="Elige tu respuesta">
        {(pregunta.opciones ?? []).map((opcion) => (
          <button
            key={opcion.id}
            type="button"
            disabled={disabled}
            onClick={() => onConfirmar(opcion.id)}
            className="min-h-11 rounded-uva-md border border-uva-divider bg-uva-surface-2 px-3.5 py-2.5 text-left text-[13.5px] text-uva-text transition-colors hover:border-uva-accent hover:bg-uva-accent-soft disabled:pointer-events-none disabled:opacity-60"
          >
            {opcion.texto}
          </button>
        ))}
      </div>
    );
  }

  if (pregunta.tipo === "OPCION_MULTIPLE") {
    const marcadas = Array.isArray(borrador) ? borrador : [];
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {(pregunta.opciones ?? []).map((opcion) => {
            const marcada = marcadas.includes(opcion.id);
            return (
              <label
                key={opcion.id}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-uva-md border px-3.5 py-2.5 text-[13.5px] transition-colors ${
                  marcada ? "border-uva-accent bg-uva-accent-soft text-uva-text" : "border-uva-divider bg-uva-surface-2 text-uva-muted"
                }`}
              >
                <input
                  type="checkbox"
                  checked={marcada}
                  disabled={disabled}
                  onChange={() =>
                    setBorrador(marcada ? marcadas.filter((id) => id !== opcion.id) : [...marcadas, opcion.id])
                  }
                  className="size-4 shrink-0 accent-uva-accent"
                />
                {opcion.texto}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-uva-text-faint">Marca todas las correctas. Solo puntúa si están todas y ninguna de más.</p>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="w-fit"
          disabled={disabled || marcadas.length === 0}
          onClick={() => onConfirmar(marcadas)}
        >
          Confirmar respuesta
        </Button>
      </div>
    );
  }

  if (pregunta.tipo === "EMPAREJAR") {
    const mapa = typeof borrador === "object" && !Array.isArray(borrador) ? (borrador as Record<string, string>) : {};
    const completo = Object.keys(mapa).length === (pregunta.izquierdas ?? []).length;
    return (
      <div className="flex flex-col gap-3">
        <PreguntaEmparejar
          izquierdas={pregunta.izquierdas ?? []}
          derechas={pregunta.derechas ?? []}
          valor={mapa}
          onCambiar={setBorrador}
          disabled={disabled}
        />
        <Button type="button" variant="primary" size="sm" className="w-fit" disabled={disabled || !completo} onClick={() => onConfirmar(mapa)}>
          Confirmar respuesta
        </Button>
      </div>
    );
  }

  // RELLENAR_ESPACIO
  const texto = typeof borrador === "string" ? borrador : "";
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`respuesta-${pregunta.id}`} className="sr-only">
        Tu respuesta
      </label>
      <Input
        id={`respuesta-${pregunta.id}`}
        value={texto}
        onChange={(event) => setBorrador(event.target.value)}
        disabled={disabled}
        maxLength={500}
        placeholder="Escribe tu respuesta"
        autoComplete="off"
      />
      <p className="text-xs text-uva-text-faint">No importan las mayúsculas ni las tildes.</p>
      <Button
        type="button"
        variant="primary"
        size="sm"
        className="w-fit"
        disabled={disabled || texto.trim() === ""}
        onClick={() => onConfirmar(texto)}
      >
        Confirmar respuesta
      </Button>
    </div>
  );
}
