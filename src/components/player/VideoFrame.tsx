"use client";

import { Play } from "lucide-react";
import { VideoPlayer } from "@/components/features/VideoPlayer";

/**
 * El mockup dibuja el frame del video con sus propios controles falsos
 * (barra de progreso, tiempo, CC, velocidad, resolución) porque es un
 * prototipo estático. Con reproducción real se delega en `VideoPlayer`
 * (features/VideoPlayer.tsx), que pide su propio token firmado por lección
 * — nunca se le pasa un playback ID crudo, eso es justo lo que ese
 * componente evita (ver su comentario). El placeholder de abajo es para el
 * único estado que `VideoPlayer` no cubre con este diseño: el video todavía
 * no terminó de procesarse (`estado_procesamiento` != LISTO), donde no hay
 * nada que pedir.
 *
 * `key={leccionId}` fuerza el remount al cambiar de clase: es la garantía
 * que pide el propio comentario de VideoPlayer para no quedarse mostrando
 * el video anterior mientras resuelve el token nuevo.
 */
export function VideoFrame({
  leccionId,
  videoListo,
  titulo,
  segundoActual,
  onTerminado,
}: {
  leccionId: string;
  videoListo: boolean;
  titulo: string;
  /** Segundo donde retomar (Revf3: guardado de progreso). */
  segundoActual?: number;
  /** Se llama una sola vez cuando el video llega al final. */
  onTerminado?: () => void;
}) {
  if (videoListo) {
    return (
      <div className="overflow-hidden rounded-uva-md bg-black">
        <VideoPlayer
          key={leccionId}
          leccionId={leccionId}
          titulo={titulo}
          segundoActual={segundoActual}
          onTerminado={onTerminado}
        />
      </div>
    );
  }

  return (
    <div className="relative h-[452px] overflow-hidden rounded-uva-md bg-black">
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="grid size-[74px] place-items-center rounded-full bg-uva-accent/90">
          <Play className="size-[26px] fill-uva-bg text-uva-bg" strokeWidth={0} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-[18px] py-4">
        <div className="h-1 rounded-full bg-white/25">
          <div className="h-full w-0 rounded-full bg-uva-accent" />
        </div>
        <div className="mt-[11px] flex items-center gap-4 text-xs text-uva-text">
          <span className="opacity-70">Video en preparación</span>
          <span className="ml-auto opacity-55">← → cambia de clase</span>
        </div>
      </div>
    </div>
  );
}
