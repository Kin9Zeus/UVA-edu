"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Flame, RotateCcw, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { PreguntaEmparejar } from "@/components/examen/PreguntaEmparejar";
import { Uvas } from "@/components/examen/Uvas";
import { Cota } from "@/components/examen/Cota";
import { enviarIntento, responderPregunta } from "@/actions/examenes/intento";
import type { IntentoEnCurso } from "@/lib/examen";
import { VIDAS_INICIALES } from "@/lib/examenes/tipos";
import type { PreguntaParaEstudiante, RespuestaEstudiante } from "@/lib/examenes/tipos";

const LETRAS = "ABCDEFGHIJ";

const INDICACION: Record<PreguntaParaEstudiante["tipo"], string> = {
  OPCION_UNICA: "Elige una",
  VERDADERO_FALSO: "Verdadero o falso",
  OPCION_MULTIPLE: "Marca todas las correctas",
  RELLENAR_ESPACIO: "Escribe la respuesta",
  EMPAREJAR: "Relaciona las parejas",
};

function suscribirNada() {
  return () => {};
}

function leerSesion(clave: string): string | null {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

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

/**
 * ¿Esta pregunta califica al TOCAR, sin un botón "Confirmar" aparte?
 *
 * EMPAREJAR entró acá aunque tenga varios pasos: cada toque en la columna
 * derecha ya es una respuesta que se manda sola (`responderPregunta` la
 * califica por par, ver `calificarEmparejarParcial`) — el estudiante nunca
 * arma un borrador que confirme después, solo va tocando y el servidor va
 * diciendo si sigue o si falló. Es "atómica por par", no una sola vez por
 * pregunta como OPCION_UNICA/VERDADERO_FALSO, pero para esta pantalla
 * (¿hay que mostrar el botón "Confirmar respuesta" de abajo?) la respuesta
 * es la misma: no.
 */
function esAtomica(pregunta: PreguntaParaEstudiante): boolean {
  return (
    pregunta.tipo === "OPCION_UNICA" ||
    pregunta.tipo === "VERDADERO_FALSO" ||
    pregunta.tipo === "EMPAREJAR"
  );
}

/** ¿El borrador ya es una respuesta que se puede confirmar con el botón de
 * abajo? Solo lo consultan OPCION_MULTIPLE y RELLENAR_ESPACIO — las dos
 * únicas que siguen usando ese botón (`esAtomica` cubre las demás). */
function borradorCompleto(pregunta: PreguntaParaEstudiante, borrador: RespuestaEstudiante): boolean {
  if (pregunta.tipo === "OPCION_MULTIPLE") return Array.isArray(borrador) && borrador.length > 0;
  if (pregunta.tipo === "RELLENAR_ESPACIO") return typeof borrador === "string" && borrador.trim() !== "";
  return false;
}

type Feedback = {
  acierto: boolean;
  cerrado: boolean;
  porTiempo: boolean;
  /** Qué pregunta toca al pulsar "Siguiente" — lo decide el servidor, no
   * este componente (la cola de reintentos no es un orden lineal). Se guarda
   * acá y se aplica en `siguiente()` para no cambiarle la pregunta debajo
   * mientras todavía está viendo cómo le fue en la anterior. */
  siguientePreguntaId?: string;
};

/** Veredicto que pinta la respuesta elegida. `null` = todavía sin calificar
 * (o cerrado por tiempo: esa respuesta nunca se evaluó y no se pinta). */
type Veredicto = "bien" | "mal" | null;

/**
 * Pantalla de rendición del examen — una pregunta a la vez, estilo juego
 * (uvas como vidas, racha, cota de progreso) con el veredicto
 * pintado sobre la propia respuesta elegida, no en un aviso aparte.
 *
 * Diseño "examen" del canvas "UVA Cursos": arriba la tarjeta de avance
 * (resueltas, uvas, cronómetro y la cota por tramos), luego el tipo de
 * pregunta, el enunciado grande y las opciones con letra; abajo la acción.
 * En celular la acción queda pegada al borde inferior, al alcance del pulgar.
 *
 * Cada respuesta se califica y persiste al confirmarla (`responderPregunta`)
 * y queda fija: no hay vuelta atrás. Fallar no saca la pregunta del examen —
 * vuelve a aparecer más adelante, después de las demás pendientes— y cuesta
 * una vida; el intento termina al responderlas todas bien, agotar las vidas,
 * o agotarse el tiempo.
 *
 * El orden lo manda el SERVIDOR (`preguntaActualId` al entrar,
 * `siguientePreguntaId` en cada respuesta): acá no se deduce. Nada de lo que
 * se ve contiene respuestas correctas: `preguntas` ya pasó por
 * `prepararPreguntasParaEstudiante()` en el servidor, y solo se colorea lo
 * que el estudiante eligió — nunca se revela cuál era la correcta.
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
  const [racha, setRacha] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  // Cuántas veces se ha mostrado una pregunta en esta sesión: es la `key` de
  // la animación de entrada y del foco. No sirve el id — si queda una sola
  // pendiente y se falla, el servidor devuelve la MISMA como siguiente.
  const [turno, setTurno] = useState(0);
  const [falladasSesion, setFalladasSesion] = useState<string[]>([]);
  // Si la pregunta en pantalla es de "Segunda vuelta", fijado al mostrarla:
  // fallarla en este turno no la convierte en segunda vuelta todavía (eso
  // pasa cuando vuelve a aparecer). `null` = primer turno sin fijar aún.
  const [vueltaEnTurno, setVueltaEnTurno] = useState<boolean | null>(null);
  const router = useRouter();
  const encabezadoRef = useRef<HTMLDivElement>(null);
  const siguienteRef = useRef<HTMLButtonElement>(null);
  const cerradoPorTiempoRef = useRef(false);

  const total = intento.preguntas.length;
  // `preguntas` trae TODAS las del examen y no cambia: lo que se mueve es
  // cuál id es la actual, así que se busca por id en vez de por índice.
  const preguntaActual = intento.preguntas.find((pregunta) => pregunta.id === preguntaActualId);
  const [borrador, setBorrador] = useState<RespuestaEstudiante>(() =>
    preguntaActual ? valorVacioPara(preguntaActual) : "",
  );

  // "Segunda vuelta": el servidor solo guarda cuántos fallos van, no cuáles,
  // así que se recuerda por pestaña (sobrevive a recargar). Si se pierde
  // (otra pestaña, modo privado), solo se pierde la etiqueta — nada que
  // afecte al examen. En el servidor no hay sessionStorage: `null`, y la
  // etiqueta aparece al hidratar.
  const claveFalladas = `uva:examen:${intento.id}:falladas`;
  const falladasGuardadas = useSyncExternalStore(
    suscribirNada,
    () => leerSesion(claveFalladas),
    () => null,
  );
  const falladas = useMemo(() => {
    let previas: string[] = [];
    try {
      const leidas: unknown = falladasGuardadas ? JSON.parse(falladasGuardadas) : [];
      if (Array.isArray(leidas)) previas = leidas.filter((id): id is string => typeof id === "string");
    } catch {
      // Valor corrupto: se ignora, igual que si no hubiera nada guardado.
    }
    return new Set([...previas, ...falladasSesion]);
  }, [falladasGuardadas, falladasSesion]);

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
          // guard para que el siguiente tick reintente cuando corresponda.
          if ("error" in resultado && resultado.error === "El tiempo del examen todavía no se agotó.") {
            cerradoPorTiempoRef.current = false;
            return;
          }
          // Cualquier otro resultado (éxito, o "ya fue enviado" porque otra
          // vía —responderPregunta— cerró el intento primero) navega igual.
          router.replace(`/cursos/${cursoSlug}/examen?tiempo=agotado`);
          router.refresh();
        });
      }
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [intento.expiraEn, intento.id, cursoSlug, router]);

  // ---------------- Foco ----------------
  // Pregunta nueva -> foco al enunciado (lo lee el lector de pantalla).
  // Veredicto -> foco al botón "Siguiente": Enter avanza sin buscarlo.
  useEffect(() => {
    if (turno > 0) encabezadoRef.current?.focus();
  }, [turno]);
  useEffect(() => {
    if (feedback) siguienteRef.current?.focus();
  }, [feedback]);

  const confirmar = useCallback(
    async (valor: RespuestaEstudiante) => {
      if (enviando || feedback) return;
      setEnviando(true);
      setError(null);
      setBorrador(valor);

      const resultado = await responderPregunta(intento.id, preguntaActualId, valor);
      setEnviando(false);

      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }

      // Solo EMPAREJAR: este par salió bien pero la pregunta sigue abierta —
      // nada que pintar, nada que gastar. El estudiante sigue tocando el
      // resto de los pares con las mismas tarjetas en pantalla.
      if (resultado.enProgreso) return;

      setVidas(resultado.vidasRestantes);
      if (resultado.acierto) {
        setCorrectas((c) => c + 1);
        setRacha((r) => r + 1);
      } else if (!resultado.porTiempo) {
        setRacha(0);
        setVueltaEnTurno((actual) => actual ?? falladas.has(preguntaActualId));
        setFalladasSesion((actuales) => [...actuales, preguntaActualId]);
        try {
          sessionStorage.setItem(claveFalladas, JSON.stringify([...falladas, preguntaActualId]));
        } catch {
          // Ver arriba: solo se pierde la etiqueta "Segunda vuelta".
        }
      }
      setFeedback({
        acierto: resultado.acierto,
        cerrado: resultado.cerrado,
        porTiempo: resultado.porTiempo ?? false,
        siguientePreguntaId: resultado.siguientePreguntaId,
      });
    },
    [enviando, feedback, intento.id, preguntaActualId, claveFalladas, falladas],
  );

  const siguiente = useCallback(() => {
    // El servidor ya dijo cuál sigue (puede ser una que se falló antes y
    // volvió al final de la cola). Sin dato, se queda donde está en vez de
    // adivinar un orden que no existe.
    const siguienteId = feedback?.siguientePreguntaId ?? preguntaActualId;
    const proxima = intento.preguntas.find((pregunta) => pregunta.id === siguienteId);
    setPreguntaActualId(siguienteId);
    setVueltaEnTurno(falladas.has(siguienteId));
    setBorrador(proxima ? valorVacioPara(proxima) : "");
    setFeedback(null);
    setTurno((t) => t + 1);
  }, [feedback, preguntaActualId, intento.preguntas, falladas]);

  const verResultado = useCallback(() => {
    router.replace(`/cursos/${cursoSlug}/examen`);
    router.refresh();
  }, [router, cursoSlug]);

  // ---------------- Teclado ----------------
  // A–J o 1–9 eligen opción (y en las atómicas, responden). Enter confirma
  // una compuesta. Nada de esto actúa si el foco está en un campo de texto o
  // en un botón (el botón ya maneja su propio Enter).
  useEffect(() => {
    function alTeclear(evento: KeyboardEvent) {
      if (!preguntaActual || feedback || enviando) return;
      if (evento.metaKey || evento.ctrlKey || evento.altKey) return;
      const objetivo = evento.target as HTMLElement | null;
      const etiqueta = objetivo?.tagName;
      if (etiqueta === "INPUT" || etiqueta === "TEXTAREA" || objetivo?.isContentEditable) return;

      if (evento.key === "Enter") {
        if (etiqueta === "BUTTON") return;
        if (!esAtomica(preguntaActual) && borradorCompleto(preguntaActual, borrador)) {
          evento.preventDefault();
          void confirmar(borrador);
        }
        return;
      }

      const opciones = preguntaActual.opciones ?? [];
      if (opciones.length === 0) return;
      const tecla = evento.key.toUpperCase();
      let indice = LETRAS.indexOf(tecla);
      if (indice === -1 && /^[1-9]$/.test(tecla)) indice = Number(tecla) - 1;
      if (indice < 0 || indice >= opciones.length) return;
      evento.preventDefault();

      const id = opciones[indice].id;
      if (esAtomica(preguntaActual)) {
        void confirmar(id);
      } else if (preguntaActual.tipo === "OPCION_MULTIPLE") {
        const marcadas = Array.isArray(borrador) ? borrador : [];
        setBorrador(marcadas.includes(id) ? marcadas.filter((m) => m !== id) : [...marcadas, id]);
      }
    }
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [preguntaActual, feedback, enviando, borrador, confirmar]);

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

  const veredicto: Veredicto = feedback && !feedback.porTiempo ? (feedback.acierto ? "bien" : "mal") : null;
  const tiempoCritico = segundosRestantes !== null && segundosRestantes <= 60;
  const segundaVuelta = vueltaEnTurno ?? falladas.has(preguntaActual.id);
  const pendientes = total - correctas;

  const anuncio = !feedback
    ? ""
    : feedback.porTiempo
      ? "Se acabó el tiempo."
      : feedback.acierto
        ? feedback.cerrado
          ? "¡Correcto! Respondiste todas las preguntas."
          : "¡Correcto!"
        : vidas === 0
          ? "Incorrecto. Te quedaste sin vidas."
          : `Incorrecto. Pierdes una vida; te quedan ${vidas}. Esta pregunta volverá a aparecer más adelante.`;

  const BOTON =
    "inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-uva-md border-0 bg-uva-btn px-6 text-uva-lead font-semibold text-uva-on-accent hover:bg-uva-btn-hover disabled:cursor-not-allowed disabled:opacity-45";
  const teclaEnter = (
    <kbd className="hidden rounded-uva-xs border border-current px-2 py-0.5 font-mono text-uva-detalle font-bold lg:inline">
      Enter
    </kbd>
  );

  let accion: ReactNode;
  if (feedback) {
    accion = (
      <button
        ref={siguienteRef}
        type="button"
        className={BOTON}
        onClick={feedback.cerrado ? verResultado : siguiente}
      >
        {feedback.cerrado ? "Ver resultado" : "Siguiente"}
        {teclaEnter}
      </button>
    );
  } else if (esAtomica(preguntaActual)) {
    // El atajo de teclado (A–D) solo existe para preguntas con `opciones`
    // planas: EMPAREJAR no tiene letras que elegir, tocar es la única forma.
    const conAtajoDeTeclado = (preguntaActual.opciones ?? []).length > 0;
    accion = (
      <p className="m-0 flex min-h-14 items-center justify-center text-center text-uva-detalle text-uva-text-muted">
        {enviando
          ? "Calificando…"
          : preguntaActual.tipo === "EMPAREJAR"
            ? "Relaciona cada elemento con su pareja"
            : "Toca tu respuesta"}
        {conAtajoDeTeclado && !enviando && (
          <span className="hidden lg:inline">
            &nbsp;o usa las teclas A–{LETRAS[(preguntaActual.opciones ?? []).length - 1] ?? "D"}
          </span>
        )}
      </p>
    );
  } else {
    accion = (
      <button
        type="button"
        className={BOTON}
        disabled={enviando || !borradorCompleto(preguntaActual, borrador)}
        onClick={() => void confirmar(borrador)}
      >
        {enviando ? "Calificando…" : "Comprobar"}
        {!enviando && teclaEnter}
      </button>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-1 flex-col gap-5 px-4 pt-5 sm:px-6 lg:gap-6 lg:px-0 lg:pt-10 lg:pb-16">
      {/* ---------- Avance ---------- */}
      <section
        aria-label="Avance del examen"
        className="rounded-uva-lg border border-uva-divider bg-uva-surface px-4.5 py-4 sm:px-6 sm:py-5"
      >
        <p className="m-0 truncate text-uva-detalle text-uva-text-muted">Examen final de {cursoTitulo}</p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <p className="m-0 flex items-baseline font-mono">
            <span className="text-uva-titulo-4 font-extrabold text-uva-text">{String(correctas).padStart(2, "0")}</span>
            <span className="font-bold text-uva-text-muted">/{String(total).padStart(2, "0")}</span>
            <span className="ml-2 font-sans text-uva-detalle text-uva-text-muted">resueltas</span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            {racha >= 2 && (
              <span
                key={racha}
                className="flex animate-uva-pop items-center gap-1 rounded-full border border-uva-accent bg-uva-accent-soft px-2 py-0.5 font-mono text-uva-detalle font-bold text-uva-accent-text"
                aria-label={`Racha de ${racha} aciertos seguidos`}
              >
                <Flame className="size-3.5" aria-hidden />×{racha}
              </span>
            )}
            <Uvas vidas={vidas} total={VIDAS_INICIALES} className="size-5" />
            {segundosRestantes !== null && (
              <p
                className={`m-0 flex items-center gap-1 font-mono text-uva-cuerpo font-bold tabular-nums ${
                  tiempoCritico ? "animate-pulse text-uva-error-text motion-reduce:animate-none" : "text-uva-text"
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
        <div className="mt-4">
          <Cota correctas={correctas} total={total} />
        </div>
      </section>

      {/* ---------- Pregunta ---------- */}
      <div key={turno} className="flex animate-uva-entrar flex-col gap-5 motion-reduce:animate-none">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex min-h-7.5 items-center rounded-full border border-uva-line-strong px-3 text-uva-detalle text-uva-text">
            {INDICACION[preguntaActual.tipo]}
          </span>
          {segundaVuelta && (
            <span className="inline-flex min-h-7.5 items-center gap-1.5 rounded-full border border-uva-accent bg-uva-accent-soft px-3 text-uva-detalle font-semibold text-uva-accent-text">
              <RotateCcw className="size-3.5" aria-hidden />
              Segunda vuelta
            </span>
          )}
          <span className="ml-auto font-mono text-uva-detalle text-uva-text-muted">
            {pendientes === 1 ? "última" : `faltan ${pendientes}`}
          </span>
        </div>

        <div ref={encabezadoRef} tabIndex={-1} className="outline-none">
          <h1 className="sr-only">
            {pendientes === 1 ? "Última pregunta" : `Te faltan ${pendientes} preguntas`}
          </h1>
          <RichTextRenderer
            contenido={preguntaActual.enunciado}
            escala="lectura"
            className="[&_p]:!max-w-none [&_p]:!text-uva-titulo-3 [&_p]:!text-uva-text"
          />
        </div>

        <PreguntaCuerpo
          pregunta={preguntaActual}
          borrador={borrador}
          onBorrador={setBorrador}
          disabled={enviando || feedback !== null}
          veredicto={veredicto}
          onConfirmar={confirmar}
        />

        {/* Lo que pasó con la respuesta. Lo anuncia el `role="status"` de
            abajo (más completo); esta línea es la versión visible. */}
        <div aria-hidden className="min-h-6.5">
          {veredicto === "mal" && !feedback?.cerrado && (
            <p className="m-0 flex animate-uva-entrar items-center gap-2 text-uva-detalle text-uva-text-muted motion-reduce:animate-none">
              <X className="size-4.5 shrink-0 text-uva-accent-ink" strokeWidth={2.4} />
              Volverá a aparecer más adelante. Pierdes una uva.
            </p>
          )}
          {veredicto === "bien" && (
            <p className="m-0 flex animate-uva-entrar items-center gap-2 text-uva-detalle font-semibold text-uva-text motion-reduce:animate-none">
              <Check className="size-4.5 shrink-0 text-uva-accent-2-text" strokeWidth={2.6} />
              {feedback?.cerrado ? "¡Bien! Respondiste todas las preguntas." : "¡Bien! Una pregunta menos."}
            </p>
          )}
          {feedback?.porTiempo && (
            <p className="m-0 flex items-center gap-2 text-uva-detalle text-uva-text-muted">
              <Clock className="size-4 shrink-0" />
              Se acabó el tiempo: esta respuesta no alcanzó a calificarse.
            </p>
          )}
        </div>
      </div>

      {/* ---------- Acción ---------- */}
      {/* En celular queda pegada abajo, al alcance del pulgar. */}
      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-uva-divider bg-uva-bg/95 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] backdrop-blur sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:mt-0 lg:border-t-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
        {error && (
          <p role="alert" className="m-0 mb-2 rounded-uva-md bg-uva-error-soft px-3 py-2 text-uva-detalle text-uva-error-text">
            {error}
          </p>
        )}
        {accion}
        <p role="status" aria-live="polite" className="sr-only">
          {anuncio}
        </p>
      </div>
    </div>
  );
}

const OPCION =
  "group flex min-h-15 w-full items-center gap-3.5 rounded-uva-md border-[1.5px] px-4 py-3 text-left text-uva-cuerpo text-uva-text transition-colors disabled:cursor-default";
const LETRA =
  "grid size-7.5 shrink-0 place-items-center rounded-uva-sm border-[1.5px] font-mono text-uva-detalle font-extrabold transition-colors";

/** Clases de una opción según su estado (diseño "examen"): acierto en el
 * amarillo de marca, fallo en magenta. Con veredicto solo se colorea lo que
 * el estudiante eligió: nunca se revela cuál era la correcta. */
function claseOpcion(elegida: boolean, veredicto: Veredicto): string {
  if (veredicto && elegida) {
    return veredicto === "bien"
      ? "border-uva-accent-2 bg-uva-accent-2-soft animate-uva-pop motion-reduce:animate-none"
      : "border-uva-accent bg-uva-accent-soft animate-uva-sacudir motion-reduce:animate-none";
  }
  if (veredicto) return "border-uva-divider bg-uva-surface opacity-80";
  if (elegida) return "border-uva-text bg-uva-surface-2";
  return "border-uva-divider bg-uva-surface hover:border-uva-line-strong";
}

function claseLetra(elegida: boolean, veredicto: Veredicto): string {
  if (veredicto && elegida) {
    return veredicto === "bien"
      ? "border-uva-accent-2 bg-uva-accent-2 text-uva-on-bright"
      : "border-uva-btn bg-uva-btn text-uva-on-accent";
  }
  if (elegida) return "border-uva-text bg-uva-text text-uva-bg";
  return "border-uva-line-strong text-uva-text-muted group-hover:text-uva-text";
}

function IconoVeredicto({ elegida, veredicto }: { elegida: boolean; veredicto: Veredicto }) {
  if (!veredicto || !elegida) return null;
  return veredicto === "bien" ? (
    <Check className="ml-auto size-5 shrink-0 text-uva-accent-2-text" strokeWidth={2.6} aria-label="Correcta" />
  ) : (
    <X className="ml-auto size-5 shrink-0 text-uva-accent-ink" strokeWidth={2.6} aria-label="Incorrecta" />
  );
}

/**
 * Cuerpo interactivo de UNA pregunta. El borrador vive en ExamenRendir (el
 * botón de confirmar está en la barra inferior, fuera de este componente).
 *
 * Atómicos (OPCION_UNICA, VERDADERO_FALSO): tocar la opción ya es "terminé",
 * así que califican al instante. EMPAREJAR también califica al tocar, pero
 * por PAR: cada vez que arma uno llama a `onConfirmar` con el mapa hasta ese
 * momento, y el servidor decide si sigue abierta o ya se resolvió (ver
 * `esAtomica` en ExamenRendir y `calificarEmparejarParcial`). Las dos que
 * quedan (OPCION_MULTIPLE, RELLENAR_ESPACIO) siguen siendo un borrador que
 * se confirma con el botón de abajo.
 */
function PreguntaCuerpo({
  pregunta,
  borrador,
  onBorrador,
  disabled,
  veredicto,
  onConfirmar,
}: {
  pregunta: PreguntaParaEstudiante;
  borrador: RespuestaEstudiante;
  onBorrador: (valor: RespuestaEstudiante) => void;
  disabled: boolean;
  veredicto: Veredicto;
  onConfirmar: (valor: RespuestaEstudiante) => void;
}) {
  if (pregunta.tipo === "OPCION_UNICA" || pregunta.tipo === "VERDADERO_FALSO") {
    // Botones, no radios: tocar una opción confirma y califica al instante —
    // no hay un estado "marcado sin confirmar" que un radio describiera.
    // `borrador` guarda la tocada, para pintarla con el veredicto.
    return (
      <div
        className={`grid gap-2.5 ${pregunta.tipo === "VERDADERO_FALSO" ? "grid-cols-2" : "grid-cols-1"}`}
        role="group"
        aria-label="Elige tu respuesta"
      >
        {(pregunta.opciones ?? []).map((opcion, i) => {
          const elegida = borrador === opcion.id;
          return (
            <button
              key={opcion.id}
              type="button"
              disabled={disabled}
              onClick={() => onConfirmar(opcion.id)}
              className={`${OPCION} ${claseOpcion(elegida, veredicto)}`}
            >
              <span
                className={`${LETRA} ${claseLetra(elegida, veredicto)}`}
                aria-hidden
              >
                {LETRAS[i]}
              </span>
              <span className="min-w-0 flex-1">{opcion.texto}</span>
              <IconoVeredicto elegida={elegida} veredicto={veredicto} />
            </button>
          );
        })}
      </div>
    );
  }

  if (pregunta.tipo === "OPCION_MULTIPLE") {
    const marcadas = Array.isArray(borrador) ? borrador : [];
    return (
      <div className="flex flex-col gap-2.5" role="group" aria-label="Marca todas las correctas">
        {(pregunta.opciones ?? []).map((opcion, i) => {
          const marcada = marcadas.includes(opcion.id);
          return (
            <button
              key={opcion.id}
              type="button"
              role="checkbox"
              aria-checked={marcada}
              disabled={disabled}
              onClick={() =>
                onBorrador(marcada ? marcadas.filter((id) => id !== opcion.id) : [...marcadas, opcion.id])
              }
              className={`${OPCION} ${claseOpcion(marcada, veredicto)}`}
            >
              <span
                className={`${LETRA} ${claseLetra(marcada, veredicto)}`}
                aria-hidden
              >
                {marcada && !veredicto ? <Check className="size-3.5" /> : LETRAS[i]}
              </span>
              <span className="min-w-0 flex-1">{opcion.texto}</span>
              <IconoVeredicto elegida={marcada} veredicto={veredicto} />
            </button>
          );
        })}
        <p className="m-0 text-uva-detalle text-uva-text-muted">Solo cuenta si marcas todas las correctas y ninguna de más.</p>
      </div>
    );
  }

  if (pregunta.tipo === "EMPAREJAR") {
    const mapa = typeof borrador === "object" && !Array.isArray(borrador) ? (borrador as Record<string, string>) : {};
    return (
      <PreguntaEmparejar
        izquierdas={pregunta.izquierdas ?? []}
        derechas={pregunta.derechas ?? []}
        valor={mapa}
        // `onConfirmar`, no `onBorrador`: cada par armado se manda al
        // servidor de una vez (calificación por par), no se acumula en un
        // borrador que se confirma después.
        onCambiar={onConfirmar}
        disabled={disabled}
        resultado={veredicto}
      />
    );
  }

  // RELLENAR_ESPACIO
  const texto = typeof borrador === "string" ? borrador : "";
  return (
    <form
      className="flex flex-col gap-1.5"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!disabled && texto.trim() !== "") onConfirmar(texto);
      }}
    >
      <label htmlFor={`respuesta-${pregunta.id}`} className="sr-only">
        Tu respuesta
      </label>
      <div className={`relative ${veredicto === "mal" ? "animate-uva-sacudir" : veredicto === "bien" ? "animate-uva-pop" : ""}`}>
        <Input
          id={`respuesta-${pregunta.id}`}
          value={texto}
          onChange={(evento) => onBorrador(evento.target.value)}
          disabled={disabled}
          maxLength={500}
          placeholder="Escribe tu respuesta"
          autoComplete="off"
          enterKeyHint="done"
          className={`h-14 rounded-uva-md border-[1.5px] pr-10 font-mono text-base disabled:opacity-100 ${
            veredicto === "bien"
              ? "border-uva-accent-2 bg-uva-accent-2-soft"
              : veredicto === "mal"
                ? "border-uva-accent bg-uva-accent-soft"
                : "border-uva-line-strong"
          }`}
        />
        {veredicto && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <IconoVeredicto elegida veredicto={veredicto} />
          </span>
        )}
      </div>
      <p className="m-0 text-uva-detalle text-uva-text-muted">No importan las mayúsculas ni las tildes.</p>
    </form>
  );
}
