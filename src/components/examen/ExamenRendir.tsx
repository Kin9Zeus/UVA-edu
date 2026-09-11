"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { enviarIntento, guardarRespuestas } from "@/actions/examenes/intento";
import type { IntentoEnCurso } from "@/lib/examen";
import type { PreguntaParaEstudiante, RespuestasIntento } from "@/lib/examenes/tipos";

/** Cada cuánto se autoguardan las respuestas si hay cambios pendientes.
 * Mismo orden de magnitud que el heartbeat del reproductor (10s): suficiente
 * para que cerrar la pestaña por accidente no cueste el intento entero, sin
 * una petición por tecla. */
const INTERVALO_AUTOGUARDADO_MS = 10_000;

function formatearRestante(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = segundos % 60;
  return `${String(minutos).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;
}

/**
 * Pantalla de rendición del examen.
 *
 * Las respuestas viven en estado local y se sincronizan por autoguardado; el
 * envío final manda además el estado completo, pero el servidor NO confía en
 * él si el tiempo ya venció (usa lo último autoguardado — ver enviarIntento).
 *
 * Nada de lo que llega acá contiene respuestas correctas: `preguntas` ya pasó
 * por `prepararPreguntasParaEstudiante()` en el servidor. Por eso la
 * calificación no se puede (ni se intenta) hacer en el cliente.
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
  const [respuestas, setRespuestas] = useState<RespuestasIntento>(intento.respuestas);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState<number | null>(null);
  const router = useRouter();

  // Refs y no estado: el temporizador y el autoguardado leen estos valores
  // desde dentro de intervalos, y meterlos como dependencias reiniciaría los
  // intervalos en cada tecla.
  const respuestasRef = useRef(respuestas);
  const sucioRef = useRef(false);
  const enviadoRef = useRef(false);

  useEffect(() => {
    respuestasRef.current = respuestas;
  }, [respuestas]);

  const enviar = useCallback(
    async (automatico: boolean) => {
      // Guard de una sola vía: el auto-envío por tiempo y el botón pueden
      // dispararse casi a la vez. El servidor también lo rechaza (filtra por
      // estado EN_CURSO), pero así no se ve un error innecesario.
      if (enviadoRef.current) return;
      enviadoRef.current = true;

      setEnviando(true);
      setError(null);
      const resultado = await enviarIntento(intento.id, respuestasRef.current);

      if (resultado.error) {
        enviadoRef.current = false;
        setEnviando(false);
        setError(resultado.error);
        return;
      }

      sucioRef.current = false;
      // La pantalla de resultado la renderiza el servidor: se navega a la
      // misma URL del examen, que ahora verá el intento cerrado.
      router.replace(`/cursos/${cursoSlug}/examen${automatico ? "?tiempo=agotado" : ""}`);
      router.refresh();
    },
    [intento.id, cursoSlug, router],
  );

  // ---------------- Temporizador ----------------
  useEffect(() => {
    if (!intento.expiraEn) return;
    const limite = new Date(intento.expiraEn).getTime();

    function tick() {
      const restante = Math.max(0, Math.round((limite - Date.now()) / 1000));
      setSegundosRestantes(restante);
      if (restante === 0) void enviar(true);
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [intento.expiraEn, enviar]);

  // ---------------- Autoguardado ----------------
  useEffect(() => {
    const id = setInterval(() => {
      if (!sucioRef.current || enviadoRef.current) return;
      sucioRef.current = false;
      void guardarRespuestas(intento.id, respuestasRef.current);
    }, INTERVALO_AUTOGUARDADO_MS);
    return () => clearInterval(id);
  }, [intento.id]);

  // Aviso al cerrar la pestaña con respuestas sin guardar. No intenta guardar
  // acá: `beforeunload` no garantiza que una petición asíncrona llegue a
  // completarse, así que lo honesto es advertir en vez de prometer.
  useEffect(() => {
    function avisar(event: BeforeUnloadEvent) {
      if (enviadoRef.current || !sucioRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

  function responder(preguntaId: string, valor: string | string[]) {
    sucioRef.current = true;
    setRespuestas((actuales) => ({ ...actuales, [preguntaId]: valor }));
  }

  const respondidas = intento.preguntas.filter((pregunta) => {
    const valor = respuestas[pregunta.id];
    if (Array.isArray(valor)) return valor.length > 0;
    return typeof valor === "string" && valor.trim() !== "";
  }).length;

  const total = intento.preguntas.length;
  const todasRespondidas = respondidas === total;
  const tiempoCritico = segundosRestantes !== null && segundosRestantes <= 60;

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-col gap-2">
        <p className="text-[13px] text-uva-muted">{cursoTitulo}</p>
        <h1 className="font-heading text-[24px] font-bold tracking-[-0.02em] text-uva-text">
          {intento.examenTitulo}
        </h1>
      </header>

      {/* Barra sticky: progreso y tiempo tienen que seguir visibles al bajar
          por un examen largo. En móvil va en UNA fila: con la nota necesaria el
          texto no cabía en 375 px, partía en dos líneas y empujaba el
          cronómetro a una tercera — 124 px fijos, casi un 20 % de la pantalla.
          La nota ya se mostró en la pantalla previa, así que ahí se omite. */}
      <div className="sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b border-uva-divider bg-uva-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <p className="min-w-0 font-mono text-[12.5px] text-uva-muted" aria-live="polite">
          {respondidas} de {total} respondidas
          <span className="hidden sm:inline"> · necesitas {intento.notaRequerida}% para aprobar</span>
        </p>

        {segundosRestantes !== null && (
          <p
            className={`flex shrink-0 items-center gap-1.5 font-mono text-[13px] font-semibold ${
              tiempoCritico ? "text-uva-error" : "text-uva-text"
            }`}
            // Solo el minuto final se anuncia: un aria-live cada segundo
            // durante media hora sería inutilizable con lector de pantalla.
            aria-live={tiempoCritico ? "assertive" : "off"}
          >
            <Clock className="size-4" aria-hidden />
            <span className="sr-only">Tiempo restante: </span>
            {formatearRestante(segundosRestantes)}
          </p>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
        >
          {error}
        </div>
      )}

      <ol className="flex flex-col gap-5">
        {intento.preguntas.map((pregunta, indice) => (
          <li
            key={pregunta.id}
            className="rounded-uva-md border border-uva-divider bg-uva-surface p-4 sm:p-5"
          >
            <PreguntaCampo
              pregunta={pregunta}
              numero={indice + 1}
              valor={respuestas[pregunta.id]}
              onResponder={(valor) => responder(pregunta.id, valor)}
              disabled={enviando}
            />
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3 border-t border-uva-divider pt-5">
        {!todasRespondidas && (
          <p className="flex items-start gap-2 text-[13px] text-uva-muted">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-uva-warn" aria-hidden />
            Te faltan {total - respondidas}{" "}
            {total - respondidas === 1 ? "pregunta" : "preguntas"} por responder. Las que dejes en
            blanco cuentan como incorrectas.
          </p>
        )}

        {confirmando ? (
          <div className="rounded-uva-md border border-uva-divider bg-uva-surface-2 p-4">
            <p className="text-[13.5px] text-uva-text">
              ¿Enviar el examen? No vas a poder cambiar tus respuestas después.
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={enviando}
                onClick={() => void enviar(false)}
              >
                {enviando ? "Enviando…" : "Sí, enviar examen"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={enviando}
                onClick={() => setConfirmando(false)}
              >
                Seguir respondiendo
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-fit"
            disabled={enviando}
            onClick={() => setConfirmando(true)}
          >
            Enviar examen
          </Button>
        )}
      </div>
    </div>
  );
}

function PreguntaCampo({
  pregunta,
  numero,
  valor,
  onResponder,
  disabled,
}: {
  pregunta: PreguntaParaEstudiante;
  numero: number;
  valor: string | string[] | undefined;
  onResponder: (valor: string | string[]) => void;
  disabled: boolean;
}) {
  const marcadas = Array.isArray(valor) ? valor : valor ? [valor] : [];

  return (
    <fieldset>
      <legend className="mb-3 flex w-full items-baseline gap-2.5">
        <span className="shrink-0 font-mono text-[12.5px] text-uva-accent">{numero}.</span>
        <span className="min-w-0 flex-1">
          <RichTextRenderer contenido={pregunta.enunciado} className="[&_p]:!text-uva-text" />
        </span>
        <span className="shrink-0 font-mono text-[11px] text-uva-text-faint">
          {pregunta.puntos} {pregunta.puntos === 1 ? "pt" : "pts"}
        </span>
      </legend>

      {pregunta.tipo === "RELLENAR_ESPACIO" ? (
        <div>
          <label htmlFor={`respuesta-${pregunta.id}`} className="sr-only">
            Tu respuesta a la pregunta {numero}
          </label>
          <Input
            id={`respuesta-${pregunta.id}`}
            value={typeof valor === "string" ? valor : ""}
            onChange={(event) => onResponder(event.target.value)}
            disabled={disabled}
            maxLength={500}
            placeholder="Escribe tu respuesta"
            autoComplete="off"
          />
          <p className="mt-1.5 text-xs text-uva-text-faint">
            No importan las mayúsculas ni las tildes.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {(pregunta.opciones ?? []).map((opcion) => {
            const multiple = pregunta.tipo === "OPCION_MULTIPLE";
            const seleccionada = marcadas.includes(opcion.id);

            return (
              <label
                key={opcion.id}
                className={`flex cursor-pointer items-start gap-2.5 rounded-uva-md border px-3.5 py-2.5 text-[13.5px] transition-colors ${
                  seleccionada
                    ? "border-uva-accent bg-uva-accent-soft text-uva-text"
                    : "border-uva-divider bg-uva-surface-2 text-uva-muted hover:border-uva-muted-2"
                }`}
              >
                <input
                  type={multiple ? "checkbox" : "radio"}
                  name={`pregunta-${pregunta.id}`}
                  value={opcion.id}
                  checked={seleccionada}
                  disabled={disabled}
                  onChange={() => {
                    if (!multiple) {
                      onResponder(opcion.id);
                      return;
                    }
                    onResponder(
                      seleccionada
                        ? marcadas.filter((id) => id !== opcion.id)
                        : [...marcadas, opcion.id],
                    );
                  }}
                  className="mt-0.5 size-4 shrink-0 accent-uva-accent"
                />
                <span>{opcion.texto}</span>
              </label>
            );
          })}
          {pregunta.tipo === "OPCION_MULTIPLE" && (
            <p className="text-xs text-uva-text-faint">
              Marca todas las correctas. Solo puntúa si están todas y ninguna de más.
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
