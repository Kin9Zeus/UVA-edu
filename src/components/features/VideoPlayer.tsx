"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import type MuxPlayerElement from "@mux/mux-player";
import { obtenerTokenReproduccion } from "@/actions/video/reproduccion";
import { guardarSegundoActual } from "@/actions/progreso/marcar";

// Cada cuánto se guarda el segundo actual mientras el video se reproduce
// (Revf3: "cada ~10 segundos con throttle, no en cada timeupdate").
const INTERVALO_GUARDADO_MS = 10_000;
// Si un guardado falla (ej. sin conexión), el siguiente intento no espera
// los 10s completos — pero tampoco reintenta en cada timeupdate (varias
// veces por segundo), que sería lo mismo que no tener throttle.
const INTERVALO_REINTENTO_MS = 3_000;
// El servidor firma el token con esta misma duración (DURACION_TOKEN en
// actions/video/reproduccion.ts) — deben mantenerse en sync a mano, ya que
// una Server Action solo puede exportar funciones y no una constante
// importable desde un componente cliente.
const DURACION_TOKEN_MS = 15 * 60 * 1000;
// Se pide un token nuevo bastante antes de que el actual expire (3 min de
// margen) para que una clase más larga que la duración del token no se
// corte a media reproducción con la sesión ya verificada.
const INTERVALO_RENOVACION_TOKEN_MS = DURACION_TOKEN_MS - 3 * 60 * 1000;
// Fracción de la duración total a partir de la cual se considera "vista":
// casi nadie ve los créditos finales hasta el segundo 100%.
const UMBRAL_COMPLETADO = 0.9;

/**
 * Reproductor de una lección. Nunca recibe un playback ID "a secas": pide
 * su propio token firmado al montar (obtenerTokenReproduccion valida sesión
 * y acceso vigente en el servidor antes de firmar, CLAUDE.md §3.3) y no lo
 * persiste en ningún lado — si el componente se desmonta y se vuelve a
 * montar, pide uno nuevo. Asume que quien lo usa lo remonta con
 * `key={leccionId}` al cambiar de lección (así lo hace VideoUploader vía
 * LeccionEditorPanel); si `leccionId` cambiara sin remontar, seguiría
 * mostrando el video anterior hasta que resuelva el nuevo token.
 *
 * También lleva el guardado de progreso (Revf3): retoma en `segundoActual`,
 * guarda la posición con throttle mientras se reproduce, fuerza un guardado
 * final por `sendBeacon` al ocultarse/cerrarse la pestaña, y marca la
 * lección completada sola al terminar el video.
 */
export function VideoPlayer({
  leccionId,
  titulo,
  segundoActual = 0,
  onTerminado,
}: {
  leccionId: string;
  titulo: string;
  /** Segundo donde retomar, tal como quedó guardado en `progreso`. */
  segundoActual?: number;
  /** Se llama una sola vez cuando el video llega al final. */
  onTerminado?: () => void;
}) {
  const [estado, setEstado] = useState<
    { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "listo"; playbackId: string; token: string }
  >({ tipo: "cargando" });

  const mediaRef = useRef<MuxPlayerElement | null>(null);
  // Última posición conocida, actualizada en CADA timeupdate (sin
  // throttle): es lo que usan el guardado al salir y el beacon, que
  // necesitan el dato más fresco posible, no el del último guardado
  // periódico (que puede tener hasta 10s de atraso).
  const posicionRef = useRef(segundoActual);
  // Próximo momento en el que se permite intentar un guardado periódico.
  // Avanza INTERVALO_GUARDADO_MS tras un guardado confirmado, o solo
  // INTERVALO_REINTENTO_MS si el último intento falló — así el reintento no
  // pierde la posición silenciosamente, pero tampoco martilla la red.
  const proximoIntentoRef = useRef(0);
  const guardandoRef = useRef(false);
  const reprodujoRef = useRef(false);
  const terminoRef = useRef(false);
  // Momento (epoch ms) en el que el token actual deja de ser válido. Sirve
  // para que el chequeo de `visibilitychange` sepa si el temporizador de
  // renovación se quedó atrás (el navegador pausa `setTimeout` en pestañas
  // en segundo plano, algo común en móvil) y toca refrescar de inmediato.
  const tokenExpiraEnRef = useRef(0);

  // Pide el token firmado (server-side, valida acceso vigente en cada
  // llamada — CLAUDE.md §3.3). Devuelve si la llamada llegó a resolverse
  // (con o sin acceso) para que quien reprograma la siguiente renovación
  // sepa si debe esperar el intervalo normal o reintentar pronto.
  const cargarToken = useCallback(async (): Promise<boolean> => {
    try {
      const resultado = await obtenerTokenReproduccion(leccionId);
      if ("error" in resultado) {
        setEstado({ tipo: "error", mensaje: resultado.error });
        return true;
      }
      setEstado({ tipo: "listo", playbackId: resultado.playbackId, token: resultado.token });
      tokenExpiraEnRef.current = Date.now() + DURACION_TOKEN_MS;
      return true;
    } catch {
      // Falla de red al pedir el token (no un rechazo de acceso): no se
      // toca `estado`, así que una renovación no derriba una reproducción
      // que sigue siendo válida con el token anterior. Se reintenta pronto
      // en vez de dejar de reprogramar renovaciones futuras.
      return false;
    }
  }, [leccionId]);

  useEffect(() => {
    let cancelado = false;
    let temporizador: ReturnType<typeof setTimeout> | undefined;

    async function cargarYReprogramar() {
      const exito = await cargarToken();
      if (cancelado) return;
      temporizador = setTimeout(
        cargarYReprogramar,
        exito ? INTERVALO_RENOVACION_TOKEN_MS : INTERVALO_REINTENTO_MS,
      );
    }

    void cargarYReprogramar();

    return () => {
      cancelado = true;
      if (temporizador) clearTimeout(temporizador);
    };
  }, [cargarToken]);

  // Respaldo del temporizador anterior: si la pestaña estuvo en segundo
  // plano el tiempo suficiente para que el navegador pausara `setTimeout`
  // (común en móvil), el token puede haber expirado antes de que la
  // renovación programada llegara a dispararse. Al volver a primer plano se
  // revisa la fecha de expiración conocida y, si ya pasó (o está por pasar),
  // se refresca de inmediato en vez de esperar a que el reproductor falle.
  useEffect(() => {
    function alVolverVisible() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() >= tokenExpiraEnRef.current) void cargarToken();
    }
    document.addEventListener("visibilitychange", alVolverVisible);
    return () => document.removeEventListener("visibilitychange", alVolverVisible);
  }, [cargarToken]);

  // Guardado al ocultar la pestaña o al cerrarla. `sendBeacon` es el único
  // transporte del navegador que sobrevive al cierre real: un Server Action
  // disparado en `pagehide` puede cortarse a medio camino si la página ya
  // terminó de descargarse antes de que la petición llegue a salir.
  useEffect(() => {
    function guardarAlSalir() {
      if (!reprodujoRef.current) return;
      if (typeof navigator.sendBeacon !== "function") return;
      const cuerpo = new Blob(
        [JSON.stringify({ leccionId, segundos: Math.floor(posicionRef.current) })],
        { type: "application/json" },
      );
      navigator.sendBeacon("/api/progreso/beacon", cuerpo);
    }

    function alCambiarVisibilidad() {
      if (document.visibilityState === "hidden") guardarAlSalir();
    }

    document.addEventListener("visibilitychange", alCambiarVisibilidad);
    window.addEventListener("pagehide", guardarAlSalir);
    return () => {
      document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      window.removeEventListener("pagehide", guardarAlSalir);
    };
  }, [leccionId]);

  // Reintenta con backoff en vez de asumir éxito (Revf3: "si falla el
  // guardado, reintentar, no perder la posición silenciosamente"). Nunca se
  // superponen dos guardados a la vez: si uno sigue en vuelo, el siguiente
  // timeupdate simplemente no dispara otro hasta que termine.
  const guardarPosicionConReintento = useCallback(
    async (segundos: number) => {
      if (guardandoRef.current) return;
      guardandoRef.current = true;
      try {
        const resultado = await guardarSegundoActual(leccionId, segundos);
        proximoIntentoRef.current = Date.now() + (resultado.ok ? INTERVALO_GUARDADO_MS : INTERVALO_REINTENTO_MS);
      } catch {
        proximoIntentoRef.current = Date.now() + INTERVALO_REINTENTO_MS;
      } finally {
        guardandoRef.current = false;
      }
    },
    [leccionId],
  );

  // Si el navegador estuvo sin conexión y la vuelve a tener, no hay que
  // esperar al próximo timeupdate con suerte de que caiga después del
  // backoff: se intenta de inmediato con la posición más reciente conocida.
  useEffect(() => {
    function alReconectar() {
      if (!reprodujoRef.current) return;
      proximoIntentoRef.current = 0;
      void guardarPosicionConReintento(posicionRef.current);
    }
    window.addEventListener("online", alReconectar);
    return () => window.removeEventListener("online", alReconectar);
  }, [guardarPosicionConReintento]);

  function handleTimeUpdate() {
    const actual = mediaRef.current?.currentTime;
    if (typeof actual !== "number") return;

    posicionRef.current = actual;
    reprodujoRef.current = true;

    // Se marca completada al llegar al 90% de la duración, no al 100%: casi
    // nadie ve los créditos finales, y esperar al evento `ended` dejaría sin
    // marcar a quien cierra la pestaña un segundo antes de que termine.
    const duracion = mediaRef.current?.duration;
    if (
      !terminoRef.current &&
      typeof duracion === "number" &&
      Number.isFinite(duracion) &&
      duracion > 0 &&
      actual / duracion >= UMBRAL_COMPLETADO
    ) {
      terminoRef.current = true;
      onTerminado?.();
    }

    if (Date.now() < proximoIntentoRef.current) return;
    void guardarPosicionConReintento(actual);
  }

  // Respaldo del umbral del 90% de arriba: cubre el caso borde de un video
  // cuya duración no se reportó a tiempo (o es tan corto que `timeupdate`
  // nunca llega a disparar con esa duración ya conocida). `terminoRef` evita
  // marcar dos veces si el umbral del 90% ya lo hizo.
  function handleEnded() {
    if (terminoRef.current) return;
    terminoRef.current = true;
    onTerminado?.();
  }

  if (estado.tipo === "cargando") {
    return (
      <div className="flex aspect-video items-center justify-center bg-uva-surface-2 text-sm text-uva-muted-2">
        Cargando video…
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div
        role="alert"
        className="flex aspect-video items-center justify-center bg-uva-badge-danger-bg px-4 text-center text-sm text-uva-badge-danger-fg"
      >
        {estado.mensaje}
      </div>
    );
  }

  return (
    <MuxPlayer
      ref={mediaRef}
      playbackId={estado.playbackId}
      tokens={{ playback: estado.token }}
      metadata={{ video_title: titulo }}
      accentColor="#ff007a"
      className="aspect-video w-full"
      startTime={segundoActual > 0 ? segundoActual : undefined}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  );
}
