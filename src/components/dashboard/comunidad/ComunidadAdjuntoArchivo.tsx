"use client";

import { useState, useTransition } from "react";
import { Download, Loader2 } from "lucide-react";
import { obtenerUrlAdjuntoComunidad } from "@/actions/comunidad/adjunto";
import { formatTamanoArchivo } from "@/lib/admin/format";
import type { ComunidadAdjunto } from "@/lib/comunidad-tipos";

/**
 * Chip de descarga para un adjunto que no es imagen (PDF/ZIP/Office). La
 * URL firmada se pide recién al hacer clic — mismo patrón que RecursosTab
 * (`src/components/player/PlayerTabs.tsx`): nada se firma de más en cada
 * carga de página, solo lo que alguien realmente va a abrir.
 */
export function ComunidadAdjuntoArchivo({ adjunto }: { adjunto: Extract<ComunidadAdjunto, { tipo: "archivo" }> }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function descargar() {
    setError(false);
    startTransition(async () => {
      const resultado = await obtenerUrlAdjuntoComunidad(adjunto.id);
      if ("error" in resultado) {
        setError(true);
        return;
      }
      window.open(resultado.url, "_blank", "noopener,noreferrer");
    });
  }

  return (
    <button
      type="button"
      onClick={descargar}
      disabled={pending}
      className="flex w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-uva-md border border-uva-divider bg-uva-bg px-3 py-2 text-left disabled:cursor-wait disabled:opacity-70"
    >
      <span className="inline-flex shrink-0 items-center rounded-uva-xs bg-uva-divider px-2 py-0.5 font-mono text-[11px] font-semibold text-uva-text-muted">
        {adjunto.extension}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm text-uva-text">{adjunto.nombre}</div>
        <div className="text-xs text-uva-text-faint">
          {error ? "No pudimos generar el enlace. Intenta de nuevo." : formatTamanoArchivo(adjunto.tamanoBytes)}
        </div>
      </div>
      {pending ? (
        <Loader2 className="size-4 shrink-0 animate-spin text-uva-text-faint" strokeWidth={2.5} />
      ) : (
        <Download className="size-4 shrink-0 text-uva-text-faint" strokeWidth={2.5} />
      )}
    </button>
  );
}
