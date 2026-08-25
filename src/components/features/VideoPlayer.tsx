"use client";

import { useEffect, useState } from "react";
import MuxPlayer from "@mux/mux-player-react";
import { obtenerTokenReproduccion } from "@/actions/video/reproduccion";

/**
 * Reproductor de una lección. Nunca recibe un playback ID "a secas": pide
 * su propio token firmado al montar (obtenerTokenReproduccion valida sesión
 * y acceso vigente en el servidor antes de firmar, CLAUDE.md §3.3) y no lo
 * persiste en ningún lado — si el componente se desmonta y se vuelve a
 * montar, pide uno nuevo. Asume que quien lo usa lo remonta con
 * `key={leccionId}` al cambiar de lección (así lo hace VideoUploader vía
 * LeccionEditorPanel); si `leccionId` cambiara sin remontar, seguiría
 * mostrando el video anterior hasta que resuelva el nuevo token.
 */
export function VideoPlayer({ leccionId, titulo }: { leccionId: string; titulo: string }) {
  const [estado, setEstado] = useState<
    { tipo: "cargando" } | { tipo: "error"; mensaje: string } | { tipo: "listo"; playbackId: string; token: string }
  >({ tipo: "cargando" });

  useEffect(() => {
    let cancelado = false;

    obtenerTokenReproduccion(leccionId).then((resultado) => {
      if (cancelado) return;
      if ("error" in resultado) {
        setEstado({ tipo: "error", mensaje: resultado.error });
        return;
      }
      setEstado({ tipo: "listo", playbackId: resultado.playbackId, token: resultado.token });
    });

    return () => {
      cancelado = true;
    };
  }, [leccionId]);

  if (estado.tipo === "cargando") {
    return (
      <div className="flex aspect-video items-center justify-center rounded-uva-md bg-uva-surface-2 text-sm text-uva-muted-2">
        Cargando video…
      </div>
    );
  }

  if (estado.tipo === "error") {
    return (
      <div
        role="alert"
        className="flex aspect-video items-center justify-center rounded-uva-md bg-uva-badge-danger-bg px-4 text-center text-sm text-uva-badge-danger-fg"
      >
        {estado.mensaje}
      </div>
    );
  }

  return (
    <MuxPlayer
      playbackId={estado.playbackId}
      tokens={{ playback: estado.token }}
      metadata={{ video_title: titulo }}
      accentColor="#ff007a"
      className="aspect-video w-full rounded-uva-md overflow-hidden"
    />
  );
}
