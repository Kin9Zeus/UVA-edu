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
    if (!usuarioActualId || pending) return;
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

  // El nombre del botón dice qué hace y `aria-pressed` si ya está activo; el
  // número va aparte (antes era el único texto del botón y el lector de
  // pantalla anunciaba "0"). Mientras guarda: `aria-disabled` y no
  // `disabled`, que le quitaba el foco a quien lo activó con el teclado.
  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        disabled={!usuarioActualId}
        aria-disabled={pending || undefined}
        aria-label={meReaccione ? "Quitar me gusta" : "Me gusta"}
        aria-pressed={meReaccione}
        onClick={toggle}
        className={`grid size-11 cursor-pointer place-items-center rounded-uva-sm border-0 bg-transparent text-uva-text-muted transition-colors hover:bg-uva-hover hover:text-uva-text disabled:cursor-not-allowed sm:pointer-fine:size-9 ${meReaccione ? "text-uva-accent-ink hover:text-uva-accent-ink" : ""}`}
      >
        <Heart aria-hidden="true" className="size-[18px]" strokeWidth={2.2} fill={meReaccione ? "currentColor" : "none"} />
      </button>
      <span className={`-ml-1 pr-1 font-bold tabular-nums ${meReaccione ? "text-uva-accent-ink" : "text-uva-text-muted"}`}>{total}</span>
    </span>
  );
}
