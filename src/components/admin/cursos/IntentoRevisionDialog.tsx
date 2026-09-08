"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { getRevisionIntento, type RevisionIntentoResultado } from "@/actions/admin/examenes";

/**
 * Detalle de un intento cerrado, pregunta por pregunta: qué marcó/escribió el
 * estudiante, cuál era la respuesta correcta, y si acertó.
 *
 * A diferencia de la pantalla del propio estudiante (que nunca revela la
 * respuesta correcta — ver ExamenIntro.tsx), acá SÍ se muestra: es la
 * herramienta del admin para entender dónde está fallando alguien, no una
 * revisión que el estudiante pueda ver.
 *
 * Se carga bajo demanda al abrir el diálogo (no junto con la lista de
 * intentos): la mayoría de las veces el admin revisa uno o dos intentos, no
 * todos, y cada uno carga el examen completo congelado.
 */
export function IntentoRevisionDialog({
  intentoId,
  onClose,
}: {
  /** `null` = diálogo cerrado. Cambiar el id recarga la revisión. */
  intentoId: string | null;
  onClose: () => void;
}) {
  const [revision, setRevision] = useState<RevisionIntentoResultado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(intentoId !== null);
  // Mismo patrón que ConfirmDialog.tsx: "ajustar estado durante el render"
  // cuando cambia una prop, en vez de un setState síncrono dentro del efecto
  // (que React desaconseja — dispara un render extra en cascada). Al cambiar
  // de intento (o cerrarse) se limpia acá, ANTES de pintar; el efecto de
  // abajo solo llama setState desde dentro del callback de la promesa, que
  // es justo el caso que React sí recomienda ("responder a un evento externo").
  const [intentoIdAnterior, setIntentoIdAnterior] = useState(intentoId);
  if (intentoId !== intentoIdAnterior) {
    setIntentoIdAnterior(intentoId);
    setRevision(null);
    setError(null);
    setCargando(intentoId !== null);
  }

  useEffect(() => {
    if (!intentoId) return;
    let cancelado = false;

    getRevisionIntento(intentoId).then((resultado) => {
      if (cancelado) return;
      setCargando(false);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setRevision(resultado);
    });

    // Evita pisar el estado con la respuesta de una carga anterior si el
    // admin cierra y abre otro intento antes de que la primera responda.
    return () => {
      cancelado = true;
    };
  }, [intentoId]);

  return (
    <Dialog open={intentoId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] w-[640px] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {revision ? `Revisión — ${revision.estudianteNombre}` : "Revisión del intento"}
          </DialogTitle>
        </DialogHeader>

        {cargando && <p className="text-[13.5px] text-uva-text-faint">Cargando…</p>}
        {error && (
          <p role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
            {error}
          </p>
        )}

        {revision && (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between rounded-uva-md bg-uva-surface-2 px-3.5 py-2.5">
              <span className="text-[13px] text-uva-muted">
                {new Date(revision.finalizadoEn ?? revision.iniciadoEn).toLocaleString("es-CO")}
              </span>
              <span className="font-mono text-[15px] font-bold text-uva-text">
                {revision.puntajePct === null ? "—" : `${revision.puntajePct}%`}
                <span className="ml-1.5 text-[11px] font-normal text-uva-text-faint">
                  de {revision.notaRequerida}% necesario
                </span>
              </span>
            </div>

            <ol className="flex flex-col gap-3">
              {revision.preguntas.map((pregunta, indice) => (
                <li
                  key={pregunta.id}
                  className={`rounded-uva-md border p-3.5 ${
                    pregunta.acertada
                      ? "border-uva-divider bg-uva-surface"
                      : "border-uva-error bg-uva-error-soft"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {pregunta.acertada ? (
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-uva-success" aria-hidden />
                    ) : (
                      <XCircle className="mt-0.5 size-4 shrink-0 text-uva-error" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-uva-text-faint">Pregunta {indice + 1}</p>
                      <RichTextRenderer contenido={pregunta.enunciado} className="[&_p]:!m-0" />
                    </div>
                  </div>

                  {pregunta.opciones ? (
                    <ul className="mt-2.5 flex flex-col gap-1 pl-6">
                      {pregunta.opciones.map((opcion) => (
                        <li
                          key={opcion.id}
                          className={`flex items-center gap-2 text-[13px] ${
                            opcion.correcta
                              ? "font-semibold text-uva-success"
                              : opcion.marcadaPorEstudiante
                                ? "text-uva-error"
                                : "text-uva-text-faint"
                          }`}
                        >
                          <span aria-hidden>
                            {opcion.marcadaPorEstudiante ? "●" : "○"}
                          </span>
                          <span>{opcion.texto}</span>
                          {opcion.correcta && <span className="text-[11px]">(correcta)</span>}
                          {opcion.marcadaPorEstudiante && !opcion.correcta && (
                            <span className="text-[11px]">(marcó esta)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="mt-2.5 pl-6 text-[13px]">
                      <p className="text-uva-text-faint">
                        Respondió:{" "}
                        <span className={pregunta.acertada ? "text-uva-success" : "text-uva-error"}>
                          {pregunta.respuestaTexto ?? "(sin responder)"}
                        </span>
                      </p>
                      {!pregunta.acertada && (
                        <p className="mt-0.5 text-uva-text-faint">
                          Aceptadas: {pregunta.respuestasAceptadas?.join(", ")}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
