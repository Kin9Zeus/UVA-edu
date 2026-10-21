"use client";

import { Play } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";
import type { ControlReproductor, VideoPlayer as VideoPlayerTipo } from "@/components/features/VideoPlayer";
import { PosterDelVideo } from "@/components/features/PosterDelVideo";
import { useModuloDiferido } from "@/lib/useModuloDiferido";
import { cn } from "@/lib/utils";

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
let reproductor: Promise<typeof VideoPlayerTipo> | null = null;
function cargarReproductor() {
  reproductor ??= import("@/components/features/VideoPlayer")
    .then((modulo) => modulo.VideoPlayer)
    .catch((error) => {
      reproductor = null;
      throw error;
    });
  return reproductor;
}

export function VideoFrame({
  leccionId,
  videoListo,
  titulo,
  segundoActual,
  posterUrl,
  onTerminado,
  controlRef,
  activarRef,
  rutaCurso,
  className,
}: {
  leccionId: string;
  videoListo: boolean;
  titulo: string;
  /** Segundo donde retomar (Revf3: guardado de progreso). */
  segundoActual?: number;
  /** Imagen del video (Mux) para el recuadro mientras carga el reproductor. */
  posterUrl?: string | null;
  /** Se llama una sola vez cuando el video llega al final. */
  onTerminado?: () => void;
  /** Ver ControlReproductor (features/VideoPlayer.tsx). */
  controlRef?: RefObject<ControlReproductor | null>;
  /** Se llena con una función que carga el reproductor y arranca en un
   * segundo (saltar desde una nota antes de haber tocado el video). */
  activarRef?: RefObject<((segundo: number) => void) | null>;
  /** Ver VideoPlayer. */
  rutaCurso?: string;
  className?: string;
}) {
  // El reproductor de Mux pesa ~290 KiB y su ejecución bloquea el hilo
  // principal más de medio segundo en un celular. Se descarga con la
  // intención de usarlo (puntero encima, foco o dedo sobre el póster, ver
  // useModuloDiferido), no con un temporizador: a los 4 s caía igual dentro
  // de la medición de Lighthouse con la sesión iniciada (TBT ~950 ms,
  // 2026-10-20). Mientras tanto el recuadro muestra el póster
  // (PosterDelVideo), que viene en el HTML; quien lo toca hace arrancar el
  // video apenas llega.
  const { modulo: VideoPlayer, pedir } = useModuloDiferido(cargarReproductor);
  const [activadoPorElUsuario, setActivadoPorElUsuario] = useState(false);
  const [inicio, setInicio] = useState<number | undefined>(undefined);

  function activarReproductor() {
    setActivadoPorElUsuario(true);
    pedir();
  }

  useEffect(() => {
    if (!activarRef) return;
    activarRef.current = (segundo) => {
      setInicio(segundo);
      setActivadoPorElUsuario(true);
      pedir();
    };
    return () => {
      activarRef.current = null;
    };
  }, [activarRef, pedir]);

  if (videoListo) {
    return (
      <div className={cn("dark overflow-hidden rounded-uva-md bg-black", className)}>
        {VideoPlayer ? (
          <VideoPlayer
            key={leccionId}
            leccionId={leccionId}
            titulo={titulo}
            segundoActual={inicio ?? segundoActual}
            posterUrl={posterUrl}
            reproducirAlCargar={activadoPorElUsuario}
            onTerminado={onTerminado}
            controlRef={controlRef}
            rutaCurso={rutaCurso}
          />
        ) : (
          <PosterDelVideo
            posterUrl={posterUrl}
            onIntencion={videoListo ? pedir : undefined}
            onActivar={activarReproductor}
            cargando={activadoPorElUsuario}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("dark relative aspect-video overflow-hidden rounded-uva-md bg-black", className)}>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="grid size-[74px] place-items-center rounded-full bg-uva-accent/90">
          <Play className="size-[26px] fill-uva-bg text-uva-bg" strokeWidth={0} />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-[18px] py-4">
        <div className="h-1 rounded-full bg-white/25">
          <div className="h-full w-0 rounded-full bg-uva-accent" />
        </div>
        {/* Antes decía también "← → cambia de clase", pero el reproductor no
            tiene ese atajo de teclado. */}
        <div className="mt-[11px] flex items-center gap-4 text-xs text-uva-text">
          <span className="opacity-70">Video en preparación</span>
        </div>
      </div>
    </div>
  );
}
