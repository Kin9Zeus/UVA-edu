"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import {
  reaccionarPostComunidad,
  quitarReaccionPostComunidad,
  reaccionarRespuestaComunidad,
  quitarReaccionRespuestaComunidad,
} from "@/actions/comunidad/reaccionar";

/** Reacción optimista — mismo patrón que el botón de like de comentarios
 * (`ComentarioItem`, src/components/player/PlayerTabs.tsx): estado local
 * que se aplica de inmediato y se revierte si el Server Action falla. */
export function ComunidadReactionButton({
  tipo,
  objetivoId,
  ruta,
  meReaccione: meReaccioneInicial,
  totalReacciones: totalInicial,
  usuarioActualId,
}: {
  tipo: "post" | "respuesta";
  objetivoId: string;
  ruta: string;
  meReaccione: boolean;
  totalReacciones: number;
  usuarioActualId: string | null;
}) {
  const router = useRouter();
  const [optimista, setOptimista] = useState<{ meReaccione: boolean; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const meReaccione = optimista?.meReaccione ?? meReaccioneInicial;
  const total = optimista?.total ?? totalInicial;

  function toggle() {
    if (!usuarioActualId) return;
    const siguiente = { meReaccione: !meReaccione, total: meReaccione ? total - 1 : total + 1 };
    setOptimista(siguiente);
    startTransition(async () => {
      const accion =
        tipo === "post"
          ? siguiente.meReaccione
            ? reaccionarPostComunidad
            : quitarReaccionPostComunidad
          : siguiente.meReaccione
            ? reaccionarRespuestaComunidad
            : quitarReaccionRespuestaComunidad;
      const resultado = await accion(objetivoId, ruta);
      if ("error" in resultado) {
        setOptimista({ meReaccione, total });
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={!usuarioActualId || pending}
      onClick={toggle}
      // `min-h-6`: objetivo táctil de 24 px, igual que CLASE_BOTON_ACCION_COMUNIDAD.
      className={`inline-flex min-h-6 cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 whitespace-nowrap text-uva-text-faint transition-colors hover:text-uva-text-muted disabled:cursor-not-allowed ${meReaccione ? "text-uva-accent hover:text-uva-accent" : ""}`}
    >
      <Heart className="size-3.5" strokeWidth={2.4} fill={meReaccione ? "currentColor" : "none"} />
      {total}
    </button>
  );
}
