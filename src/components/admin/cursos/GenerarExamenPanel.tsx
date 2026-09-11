"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { useAdminToast } from "@/components/admin/Toast";
import {
  consultarGeneracionDelCurso,
  generarExamenDelCurso,
  obtenerEstadoTranscripciones,
  type EstadoTranscripcionesCurso,
} from "@/actions/admin/generacionExamen";
// Desde `tipos.ts` y NO desde `trabajo.ts`: aquel solo importa zod, mientras
// que este importa el cliente con service role y el de Gemini. Ver el
// comentario del reexport en trabajo.ts.
import {
  TOTAL_PREGUNTAS_MAXIMO,
  TOTAL_PREGUNTAS_MINIMO,
  type EstadoTrabajoGeneracion,
} from "@/lib/examenes/generacion/tipos";

/**
 * Generación del examen a partir de las transcripciones del curso.
 *
 * Por qué "disparar y sondear" y no esperar la respuesta
 * ------------------------------------------------------
 * Una llamada al modelo con las transcripciones de un curso entero tarda
 * minutos. `generarExamenDelCurso` reclama el turno de forma síncrona y hace
 * el trabajo en `after()`, así que lo que vuelve enseguida es un `trabajoId`,
 * no un examen. Esta pantalla sondea `consultarGeneracionDelCurso` hasta que
 * el trabajo deja de estar PENDIENTE y solo entonces hace `router.refresh()`.
 *
 * La consecuencia importante para quien lea esto: cerrar la pestaña NO cancela
 * la generación —sigue en el servidor— y al volver a entrar el sondeo
 * reengancha con el trabajo en curso, porque el estado vive en la tabla y no
 * en este componente. De ahí que se consulte también al montar, no solo tras
 * pulsar el botón.
 *
 * Por qué no se publica solo
 * --------------------------
 * `persistirPreguntasGeneradas` deja el examen en `publicado: false` SIEMPRE.
 * Un examen generado por un modelo es un borrador para revisar, no algo que
 * deba empezar a bloquear certificados sin que una persona lo lea. La UI lo
 * dice en vez de esconderlo.
 */

/** Cada cuánto se pregunta por el trabajo en curso. Suficientemente espaciado
 *  para no castigar la base con un trabajo que dura minutos, y suficientemente
 *  corto para que el resultado no parezca colgado. */
const MS_ENTRE_SONDEOS = 3000;

/** Valor de partida del selector: un examen de 10 preguntas es corto de rendir
 *  y suficiente para separar a quien hizo el curso de quien no. No depende del
 *  número de lecciones a propósito — ese era justo el problema del modo
 *  anterior, donde un curso de 20 clases no podía bajar de 20 preguntas. */
const TOTAL_PREGUNTAS_POR_DEFECTO = 10;

export function GenerarExamenPanel({
  cursoId,
  tieneExamen,
  preguntasGeneradas,
}: {
  cursoId: string;
  /** Cambia el texto del botón entre "Generar" y "Regenerar" y activa la
   *  confirmación: regenerar reemplaza las preguntas generadas que ya hay. */
  tieneExamen: boolean;
  /** Cuántas de las preguntas actuales vienen de una generación. Es el número
   *  que la confirmación necesita para decir qué se va a perder. */
  preguntasGeneradas: number;
}) {
  const router = useRouter();
  const showToast = useAdminToast();

  const [estado, setEstado] = useState<EstadoTranscripcionesCurso | null>(null);
  const [errorEstado, setErrorEstado] = useState<string | null>(null);
  const [total, setTotal] = useState(TOTAL_PREGUNTAS_POR_DEFECTO);
  const [trabajo, setTrabajo] = useState<EstadoTrabajoGeneracion | null>(null);
  const [lanzando, setLanzando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const generando = trabajo?.estado === "PENDIENTE";

  // El id del intervalo vive en una ref y no en estado: cambiarlo no debe
  // provocar un render, y el cleanup necesita leer el valor más reciente.
  const sondeoRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detenerSondeo = useCallback(() => {
    if (sondeoRef.current !== null) {
      clearInterval(sondeoRef.current);
      sondeoRef.current = null;
    }
  }, []);

  /* Un solo sitio donde se vuelca la respuesta al estado, para que la lectura
     al montar y la de después de cada corrida no se separen con el tiempo. */
  const aplicarEstado = useCallback(
    (resultado: Awaited<ReturnType<typeof obtenerEstadoTranscripciones>>) => {
      if (resultado.error) {
        setErrorEstado(resultado.error);
        return;
      }
      setErrorEstado(null);
      setEstado(resultado.estado ?? null);
    },
    [],
  );

  const cargarEstado = useCallback(
    () => obtenerEstadoTranscripciones(cursoId).then(aplicarEstado),
    [cursoId, aplicarEstado],
  );

  /* Al montar se leen las dos cosas que no puede saber el padre:
     - el estado de las transcripciones, para decir "faltan 3 de 12" ANTES de
       que alguien pulse el botón y se lleve el error;
     - si ya hay un trabajo PENDIENTE, porque alguien lo lanzó y cerró la
       pestaña, o porque lo lanzó otro administrador desde otra sesión. Con eso
       el efecto de abajo reengancha el sondeo solo.

     Los `setState` van dentro de los callbacks de la promesa y no en el cuerpo
     del efecto: hacerlo síncrono encadena renders (react-hooks/set-state-in-effect). */
  useEffect(() => {
    let vigente = true;

    void obtenerEstadoTranscripciones(cursoId).then((r) => {
      if (vigente) aplicarEstado(r);
    });
    void consultarGeneracionDelCurso(cursoId).then((r) => {
      if (vigente && !r.error) setTrabajo(r.trabajo ?? null);
    });

    return () => {
      vigente = false;
    };
  }, [cursoId, aplicarEstado]);

  useEffect(() => {
    if (!generando) {
      detenerSondeo();
      return;
    }
    if (sondeoRef.current !== null) return;

    sondeoRef.current = setInterval(async () => {
      const resultado = await consultarGeneracionDelCurso(cursoId);
      if (resultado.error || !resultado.trabajo) return;

      setTrabajo(resultado.trabajo);

      if (resultado.trabajo.estado !== "PENDIENTE") {
        detenerSondeo();
        if (resultado.trabajo.estado === "COMPLETADO") {
          showToast(
            `Examen generado: ${resultado.trabajo.preguntasValidadas} preguntas en borrador.`,
          );
          // Trae las preguntas nuevas desde el servidor. Sin esto la pestaña
          // seguiría mostrando el examen anterior (o el vacío) hasta recargar.
          router.refresh();
        } else {
          showToast(resultado.trabajo.error ?? "La generación falló.", "error");
        }
        void cargarEstado();
      }
    }, MS_ENTRE_SONDEOS);

    return detenerSondeo;
  }, [generando, cursoId, detenerSondeo, router, showToast, cargarEstado]);

  // Desmontaje: cambiar de pestaña no debe dejar un intervalo suelto pidiendo
  // a la base para siempre.
  useEffect(() => detenerSondeo, [detenerSondeo]);

  async function lanzar() {
    setConfirmando(false);
    setLanzando(true);
    const resultado = await generarExamenDelCurso(cursoId, total);
    setLanzando(false);

    if (resultado.error) {
      showToast(resultado.error, "error");
      return;
    }
    if (resultado.omitido === "ya_hay_uno_en_curso") {
      showToast("Ya hay una generación en curso para este curso.", "error");
      // No es un fallo: alguien más la lanzó. Se engancha el sondeo a la suya.
      const actual = await consultarGeneracionDelCurso(cursoId);
      if (!actual.error) setTrabajo(actual.trabajo ?? null);
      return;
    }
    if (resultado.omitido === "ya_generado") {
      showToast("Este curso ya tiene un examen generado y validado.", "error");
      return;
    }

    showToast("Generando… puedes seguir trabajando, esto sigue en el servidor.");
    const actual = await consultarGeneracionDelCurso(cursoId);
    if (!actual.error) setTrabajo(actual.trabajo ?? null);
  }

  const faltan = estado?.faltantes ?? [];
  const puedeGenerar = estado?.puedeGenerar === true && !generando && !lanzando;

  return (
    <div className="max-w-[560px] rounded-uva-md border border-uva-divider bg-uva-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-heading text-[15px] font-bold tracking-[-0.02em] text-uva-text">
            <Sparkles className="size-4 text-uva-accent" />
            Generar preguntas desde los videos
          </h3>
          <p className="mt-1.5 text-[13px] leading-relaxed text-uva-muted">
            Se leen las transcripciones de todas las clases del curso y se
            proponen preguntas de opción única, cada una anclada a una frase
            literal de su video.
          </p>
        </div>
        {estado ? (
          <StatusBadge tone={estado.puedeGenerar ? "success" : "warning"}>
            {estado.listos}/{estado.totalVideos}
          </StatusBadge>
        ) : null}
      </div>

      {errorEstado ? (
        <p className="mt-3 text-[13px] text-uva-error">{errorEstado}</p>
      ) : null}

      {estado && estado.totalVideos === 0 ? (
        <p className="mt-3 text-[13px] leading-relaxed text-uva-text-faint">
          Este curso todavía no tiene clases con video, así que no hay de qué
          preguntar. Sube los videos y vuelve.
        </p>
      ) : null}

      {faltan.length > 0 ? (
        <div className="mt-3 rounded-[6px] border border-uva-divider bg-uva-bg p-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-uva-badge-warn-fg">
            <AlertTriangle className="size-3.5" />
            Faltan {faltan.length} {faltan.length === 1 ? "transcripción" : "transcripciones"}
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-uva-muted">
            Mux las genera solo tras subir el video y tarda un rato. No se puede
            generar el examen a medias: saldría sin preguntas de estas clases y
            nadie lo notaría.
          </p>
          <ul className="mt-2 space-y-0.5">
            {faltan.map((video) => (
              <li key={video.videoId} className="text-[12.5px] text-uva-text-faint">
                · {video.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {trabajo && trabajo.estado !== "PENDIENTE" ? (
        <ResultadoTrabajo trabajo={trabajo} totalVideos={estado?.totalVideos ?? 0} />
      ) : null}

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-[132px]">
          <Label htmlFor="total-preguntas" className="text-[12.5px]">
            Preguntas del examen
          </Label>
          <Input
            id="total-preguntas"
            type="number"
            min={TOTAL_PREGUNTAS_MINIMO}
            max={TOTAL_PREGUNTAS_MAXIMO}
            value={total}
            disabled={generando}
            onChange={(e) => {
              const valor = Number(e.target.value);
              if (!Number.isFinite(valor)) return;
              // Se acota aquí además de en el Server Action: el `min`/`max`
              // del input no impide teclear un valor fuera de rango.
              setTotal(
                Math.min(
                  TOTAL_PREGUNTAS_MAXIMO,
                  Math.max(TOTAL_PREGUNTAS_MINIMO, Math.round(valor)),
                ),
              );
            }}
            className="mt-1"
          />
        </div>

        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!puedeGenerar}
          onClick={() => (tieneExamen && preguntasGeneradas > 0 ? setConfirmando(true) : lanzar())}
        >
          <Sparkles className="size-4" />
          {generando
            ? "Generando…"
            : lanzando
              ? "Lanzando…"
              : tieneExamen
                ? "Regenerar preguntas"
                : "Generar examen"}
        </Button>

        {estado && estado.totalVideos > 0 ? (
          <p className="text-[12.5px] leading-relaxed text-uva-text-faint">
            {total < estado.totalVideos
              ? `El curso tiene ${estado.totalVideos} lecciones: la IA elegirá los ${total} conceptos más evaluables.`
              : `Alcanza para cubrir las ${estado.totalVideos} lecciones.`}
          </p>
        ) : null}
      </div>

      <p className="mt-3 text-[12.5px] leading-relaxed text-uva-text-faint">
        El examen se guarda en <strong className="font-semibold">borrador</strong>. Reví­salo y
        publícalo tú: nada de esto le llega a un estudiante hasta que lo hagas.
      </p>

      <ConfirmDialog
        open={confirmando}
        onOpenChange={setConfirmando}
        title="¿Regenerar las preguntas?"
        description={
          `Se reemplazan las ${preguntasGeneradas} preguntas generadas que ya tiene este examen. ` +
          `Las que hayas escrito o editado a mano se conservan, y el examen sigue en borrador.`
        }
        confirmLabel="Regenerar"
        onConfirm={lanzar}
      />
    </div>
  );
}

/**
 * Resumen del último trabajo terminado. Se muestra hasta que se lance otro:
 * saber que la corrida anterior dejó 3 clases sin preguntas es justo lo que el
 * administrador necesita para decidir si repetirla.
 *
 * `totalVideos` hace falta para no gritar sin motivo. Desde que el examen se
 * pide por total, un curso de 12 lecciones con 4 preguntas deja 8 lecciones
 * vacías POR DISEÑO; pintar eso en ámbar entrenaría a ignorar el aviso, y
 * entonces el día que sí importe —examen largo, lección con la transcripción
 * rota— tampoco se miraría.
 */
function ResultadoTrabajo({
  trabajo,
  totalVideos,
}: {
  trabajo: EstadoTrabajoGeneracion;
  totalVideos: number;
}) {
  if (trabajo.estado === "FALLIDO") {
    return (
      <div className="mt-3 rounded-[6px] border border-uva-divider bg-uva-bg p-3">
        <StatusBadge tone="error">Falló</StatusBadge>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-uva-muted">
          {trabajo.error ?? "No quedó registrado el motivo."}
        </p>
      </div>
    );
  }

  const descartadas = trabajo.preguntasRecibidas - trabajo.preguntasValidadas;

  return (
    <div className="mt-3 rounded-[6px] border border-uva-divider bg-uva-bg p-3">
      <StatusBadge tone="success">Última generación</StatusBadge>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-uva-muted">
        {trabajo.preguntasValidadas} preguntas guardadas
        {descartadas > 0 ? (
          <>
            {" "}
            · {descartadas} descartadas porque la frase citada no aparecía tal cual en la
            transcripción
          </>
        ) : null}
      </p>
      {trabajo.videosSinPreguntas.length > 0 ? (
        // Solo es un problema si el examen daba para cubrir el temario entero.
        // Si no, es la consecuencia de haber pedido un examen corto.
        trabajo.preguntasValidadas >= totalVideos ? (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-uva-badge-warn-fg">
            Sin ninguna pregunta: {trabajo.videosSinPreguntas.join(", ")} — revisa esas
            transcripciones.
          </p>
        ) : (
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-uva-text-faint">
            {trabajo.videosSinPreguntas.length} lecciones quedaron fuera: pediste menos
            preguntas que lecciones tiene el curso.
          </p>
        )
      ) : null}
    </div>
  );
}
