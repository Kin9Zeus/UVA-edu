"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Clock, Flame, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * En móvil ocupa exactamente la pantalla (`h-dvh`): arriba el marcador,
 * al centro la pregunta y abajo, al alcance del pulgar, la acción. Si una
 * pregunta excepcionalmente larga no cabe, solo el bloque central se
 * desplaza — el marcador y el botón nunca se van de la pantalla.
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
    setBorrador(proxima ? valorVacioPara(proxima) : "");
    setFeedback(null);
    setTurno((t) => t + 1);
  }, [feedback, preguntaActualId, intento.preguntas]);

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
  const segundaVuelta = falladas.has(preguntaActual.id);
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

  let accion: ReactNode;
  if (feedback) {
    accion = (
      <Button
        ref={siguienteRef}
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        onClick={feedback.cerrado ? verResultado : siguiente}
      >
        {feedback.cerrado ? "Ver resultado" : "Siguiente"}
        <kbd className="ml-1 hidden rounded border border-white/30 px-1.5 font-mono text-[10.5px] font-normal lg:inline">
          Enter
        </kbd>
      </Button>
    );
  } else if (esAtomica(preguntaActual)) {
    // El atajo de teclado (A–D) solo existe para preguntas con `opciones`
    // planas: EMPAREJAR no tiene letras que elegir, tocar es la única forma.
    const conAtajoDeTeclado = (preguntaActual.opciones ?? []).length > 0;
    accion = (
      <p className="flex h-[46px] items-center justify-center text-[13px] text-uva-text-faint">
        {enviando
          ? "Calificando…"
          : preguntaActual.tipo === "EMPAREJAR"
            ? "Relaciona cada elemento con su pareja"
            : "Toca tu respuesta"}
        {conAtajoDeTeclado && (
          <span className="hidden lg:inline">
            &nbsp;o usa las teclas A–{LETRAS[(preguntaActual.opciones ?? []).length - 1] ?? "D"}
          </span>
        )}
      </p>
    );
  } else {
    accion = (
      <Button
        type="button"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={enviando || !borradorCompleto(preguntaActual, borrador)}
        onClick={() => void confirmar(borrador)}
      >
        {enviando ? "Calificando…" : "Confirmar respuesta"}
      </Button>
    );
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[600px] flex-col lg:h-auto lg:min-h-[calc(100dvh-65px)] lg:py-6">
      {/* ---------- Marcador ---------- */}
      <div className="flex shrink-0 flex-col gap-2.5 border-b border-uva-divider bg-uva-bg/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur sm:px-6 lg:rounded-uva-md lg:border lg:bg-uva-surface/60 lg:pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-[11px] font-medium uppercase tracking-[0.12em] text-uva-text-faint">
              {cursoTitulo}
            </p>
            <p className="font-mono text-[13px] text-uva-text">
              <span className="text-[17px] font-semibold">{String(correctas).padStart(2, "0")}</span>
              <span className="text-uva-text-faint">/{String(total).padStart(2, "0")}</span>
              <span className="ml-1.5 font-sans text-[12px] text-uva-muted">resueltas</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3.5">
            {racha >= 2 && (
              <span
                key={racha}
                className="flex animate-uva-pop items-center gap-1 rounded-full border border-uva-accent/40 bg-uva-accent-soft px-2 py-0.5 font-mono text-[12px] font-semibold text-uva-accent-text"
                aria-label={`Racha de ${racha} aciertos seguidos`}
              >
                <Flame className="size-3.5" aria-hidden />×{racha}
              </span>
            )}
            <Uvas vidas={vidas} total={VIDAS_INICIALES} />
            {segundosRestantes !== null && (
              <p
                className={`flex items-center gap-1 font-mono text-[14px] font-semibold tabular-nums ${
                  tiempoCritico ? "animate-pulse text-uva-error" : "text-uva-text"
                }`}
                aria-live={tiempoCritico ? "assertive" : "off"}
              >
                <Clock className="size-3.5" aria-hidden />
                <span className="sr-only">Tiempo restante: </span>
                {formatearRestante(segundosRestantes)}
              </p>
            )}
          </div>
        </div>
        <Cota correctas={correctas} total={total} />
      </div>

      {/* ---------- Pregunta ---------- */}
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 sm:px-6 lg:overflow-visible lg:px-0">
        <div key={turno} className="my-auto flex animate-uva-entrar flex-col gap-4 py-4 lg:py-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-uva-divider px-2.5 py-0.5 text-[11.5px] text-uva-muted">
              {INDICACION[preguntaActual.tipo]}
            </span>
            {segundaVuelta && (
              <span className="flex items-center gap-1 rounded-full border border-uva-accent/40 bg-uva-accent-soft px-2.5 py-0.5 text-[11.5px] font-medium text-uva-accent-text">
                <RotateCcw className="size-3" aria-hidden />
                Segunda vuelta
              </span>
            )}
            <span className="ml-auto font-mono text-[11.5px] text-uva-text-faint">
              {pendientes === 1 ? "última" : `faltan ${pendientes}`}
            </span>
          </div>

          <div ref={encabezadoRef} tabIndex={-1} className="outline-none">
            <h1 className="sr-only">
              {pendientes === 1 ? "Última pregunta" : `Te faltan ${pendientes} preguntas`}
            </h1>
            <RichTextRenderer
              contenido={preguntaActual.enunciado}
              className="[&_p]:!max-w-none [&_p]:!font-heading [&_p]:!text-[17px] [&_p]:!font-semibold [&_p]:!leading-snug [&_p]:!text-uva-text lg:[&_p]:!text-[21px]"
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

          {veredicto === "mal" && !feedback?.cerrado && (
            <p className="flex animate-uva-entrar items-center gap-1.5 text-[12.5px] text-uva-muted">
              <RotateCcw className="size-3.5 shrink-0" aria-hidden />
              Volverá a aparecer más adelante · −1 uva
            </p>
          )}
          {feedback?.porTiempo && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-uva-muted">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              Se acabó el tiempo: esta respuesta no alcanzó a calificarse.
            </p>
          )}
        </div>
      </div>

      {/* ---------- Acción ---------- */}
      <div className="shrink-0 border-t border-uva-divider bg-uva-bg/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-6 lg:border-t-0 lg:bg-transparent lg:px-0">
        {error && (
          <p role="alert" className="mb-2 rounded-uva-md bg-uva-error-soft px-3 py-2 text-[13px] text-uva-error-text">
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

/** Clases de una opción según su estado. `elegida` = la marcó el
 * estudiante; con veredicto, solo lo elegido se colorea. */
function claseOpcion(elegida: boolean, veredicto: Veredicto): string {
  if (veredicto && elegida) {
    return veredicto === "bien"
      ? "border-uva-valid bg-uva-valid-soft text-uva-text animate-uva-pop"
      : "border-uva-error bg-uva-error-soft text-uva-text animate-uva-sacudir";
  }
  if (veredicto) return "border-uva-divider bg-uva-surface text-uva-text-faint opacity-60";
  if (elegida) return "border-uva-accent bg-uva-accent-soft text-uva-text";
  return "border-uva-divider bg-uva-surface text-uva-text hover:border-uva-accent/60 hover:bg-uva-hover";
}

function claseLetra(elegida: boolean, veredicto: Veredicto): string {
  if (veredicto && elegida) return veredicto === "bien" ? "bg-uva-valid text-uva-bg" : "bg-uva-error text-white";
  if (elegida) return "bg-uva-accent text-white";
  return "border border-uva-divider text-uva-muted group-hover:border-uva-accent/60 group-hover:text-uva-text";
}

function IconoVeredicto({ elegida, veredicto }: { elegida: boolean; veredicto: Veredicto }) {
  if (!veredicto || !elegida) return null;
  return veredicto === "bien" ? (
    <Check className="ml-auto size-5 shrink-0 text-uva-valid" aria-label="Correcta" />
  ) : (
    <X className="ml-auto size-5 shrink-0 text-uva-error" aria-label="Incorrecta" />
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
        className={`grid gap-2 ${pregunta.tipo === "VERDADERO_FALSO" ? "grid-cols-2" : "grid-cols-1"}`}
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
              className={`group flex min-h-12 items-center gap-3 rounded-uva-md border px-3 py-2.5 text-left text-[14.5px] leading-snug transition-colors disabled:cursor-default ${claseOpcion(
                elegida,
                veredicto,
              )}`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-[6px] font-mono text-[12px] font-semibold transition-colors ${claseLetra(
                  elegida,
                  veredicto,
                )}`}
                aria-hidden
              >
                {LETRAS[i]}
              </span>
              <span className="min-w-0">{opcion.texto}</span>
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
      <div className="flex flex-col gap-2" role="group" aria-label="Marca todas las correctas">
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
              className={`group flex min-h-12 items-center gap-3 rounded-uva-md border px-3 py-2.5 text-left text-[14.5px] leading-snug transition-colors disabled:cursor-default ${claseOpcion(
                marcada,
                veredicto,
              )}`}
            >
              <span
                className={`grid size-7 shrink-0 place-items-center rounded-[6px] font-mono text-[12px] font-semibold transition-colors ${claseLetra(
                  marcada,
                  veredicto,
                )}`}
                aria-hidden
              >
                {marcada && !veredicto ? <Check className="size-3.5" /> : LETRAS[i]}
              </span>
              <span className="min-w-0">{opcion.texto}</span>
              <IconoVeredicto elegida={marcada} veredicto={veredicto} />
            </button>
          );
        })}
        <p className="text-[11.5px] text-uva-text-faint">Solo cuenta si marcas todas las correctas y ninguna de más.</p>
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
          className={`h-12 pr-10 font-mono text-[15px] disabled:opacity-100 ${
            veredicto === "bien"
              ? "border-uva-valid bg-uva-valid-soft"
              : veredicto === "mal"
                ? "border-uva-error bg-uva-error-soft"
                : ""
          }`}
        />
        {veredicto && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            <IconoVeredicto elegida veredicto={veredicto} />
          </span>
        )}
      </div>
      <p className="text-[11.5px] text-uva-text-faint">No importan las mayúsculas ni las tildes.</p>
    </form>
  );
}
