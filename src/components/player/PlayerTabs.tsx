"use client";

import type { DocumentoContenido } from "@/lib/editor/tipos";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";

/*
 * Piezas sueltas del reproductor anterior que siguen en uso: la vista previa
 * de administración (LeccionVistaPreviaContent) usa ResumenTab.
 */

export function ResumenTab({ contenido }: { contenido: DocumentoContenido | null }) {
  if (!contenido) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[640px] text-[13.5px] text-uva-muted">
          El instructor todavía no publicó el resumen de esta clase.
        </p>
      </div>
    );
  }

  return <RichTextRenderer contenido={contenido} />;
}
