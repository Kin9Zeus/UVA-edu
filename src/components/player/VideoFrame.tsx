"use client";

import { Play } from "lucide-react";
import { useEffect, useRef, useState, type RefObject } from "react";
import type { ControlReproductor, VideoPlayer as VideoPlayerTipo } from "@/components/features/VideoPlayer";
import { PosterDelVideo } from "@/components/features/PosterDelVideo";
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
/** Espera tras hidratar antes de cargar el reproductor si nadie toca el póster. */
const ESPERA_ANTES_DEL_REPRODUCTOR_MS = 4_000;

export function VideoFrame({
  leccionId,
  videoListo,
  titulo,
  segundoActual,
  posterUrl,
  onTerminado,
  controlRef,
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
  className?: string;
}) {
  // El reproductor de Mux pesa ~290 KiB y tardaba ~765 ms en ejecutarse justo
  // después de hidratar, dentro de la ventana donde se mide el TBT (lección:
  // 581 ms, Rendimiento 78 en Lighthouse móvil). Se descarga aparte de la
  // página y unos segundos después de hidratar, para que la clase ya sea
  // visible y usable; quien toca el póster antes lo carga de inmediato y el
  // video arranca solo. Mientras tanto el recuadro muestra el póster
  // (PosterDelVideo), que viene en el HTML.
  const [VideoPlayer, setVideoPlayer] = useState<typeof VideoPlayerTipo | null>(null);
  const [activadoPorElUsuario, setActivadoPorElUsuario] = useState(false);
  const cargarReproductorRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (!videoListo) return;
    let cancelado = false;
    const cargar = () => {
      clearTimeout(temporizador);
      void import("@/components/features/VideoPlayer").then((modulo) => {
        if (!cancelado) setVideoPlayer(() => modulo.VideoPlayer);
      });
    };
    const temporizador = setTimeout(cargar, ESPERA_ANTES_DEL_REPRODUCTOR_MS);
    cargarReproductorRef.current = cargar;
    return () => {
      cancelado = true;
      clearTimeout(temporizador);
      cargarReproductorRef.current = () => {};
    };
  }, [videoListo]);

  function activarReproductor() {
    setActivadoPorElUsuario(true);
    cargarReproductorRef.current();
  }

  if (videoListo) {
    return (
      <div className={cn("dark overflow-hidden rounded-uva-md bg-black", className)}>
        {VideoPlayer ? (
          <VideoPlayer
            key={leccionId}
            leccionId={leccionId}
            titulo={titulo}
            segundoActual={segundoActual}
            posterUrl={posterUrl}
            reproducirAlCargar={activadoPorElUsuario}
            onTerminado={onTerminado}
            controlRef={controlRef}
          />
        ) : (
          <PosterDelVideo
            posterUrl={posterUrl}
            onActivar={activarReproductor}
            cargando={activadoPorElUsuario}
          />
        )}
      </div>
    );
  }

  return (
    <div className={cn("dark relative h-[452px] overflow-hidden rounded-uva-md bg-black", className)}>
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
