"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ComunidadReactionButton } from "@/components/dashboard/comunidad/ComunidadReactionButton";
import { ComunidadAdjuntoVista } from "@/components/dashboard/comunidad/ComunidadAdjuntoVista";
import { eliminarRespuestaComunidad } from "@/actions/comunidad/eliminar";
import { renderizarTextoFormateado } from "@/lib/formato-texto";
import { CLASE_BOTON_ACCION_COMUNIDAD, type ComunidadRespuesta } from "@/lib/comunidad-tipos";

function iniciales(nombre: string) {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

export function ComunidadRespuestaItem({
  respuesta,
  ruta,
  usuarioActualId,
  esAdmin,
}: {
  respuesta: ComunidadRespuesta;
  ruta: string;
  usuarioActualId: string | null;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const puedeEliminar = !respuesta.eliminado && (usuarioActualId === respuesta.autorId || esAdmin);

  const adjuntosPorId = new Map(respuesta.adjuntos.map((adjunto) => [adjunto.id, adjunto]));
  function resolverAdjunto(id: string) {
    const adjunto = adjuntosPorId.get(id);
    return adjunto ? <ComunidadAdjuntoVista adjunto={adjunto} /> : null;
  }

  // Igual que en ComunidadPostCard: ConfirmDialog sigue abierto ("Procesando…")
  // hasta que esto termina.
  async function eliminar() {
    await eliminarRespuestaComunidad(respuesta.id, ruta);
    router.refresh();
  }

  return (
    <div className="flex items-start gap-2.5 py-3">
      <Avatar className="size-7 shrink-0 bg-uva-divider">
        <AvatarFallback className="bg-uva-divider text-xs text-uva-text">
          {iniciales(respuesta.autorNombre)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        {/* `m-0`: el margin-bottom por defecto de un `<p>` (~14px) cuenta
            para el centrado en un flex item y descuadraba el nombre contra
            el avatar. `leading-7` iguala la altura de línea a la del
            avatar (`size-7`, 28px) — con `items-start` en la fila, ambos
            parten del mismo borde superior y quedan centrados entre sí. */}
        <p className="m-0 text-sm leading-7 text-uva-text">{respuesta.autorNombre}</p>
        <div
          className={`flex flex-col gap-2 text-sm wrap-break-word ${respuesta.eliminado ? "text-uva-text-faint italic" : "text-uva-text-muted"}`}
        >
          {respuesta.eliminado ? "[respuesta eliminada]" : renderizarTextoFormateado(respuesta.contenido, resolverAdjunto)}
        </div>
        {/* Misma fila que la de ComunidadPostCard: se parte sin cortar
            palabras y la acción va a la derecha. */}
        <div className="mt-1 flex flex-wrap items-center gap-x-4 text-xs text-uva-text-faint">
          <span className="whitespace-nowrap">{respuesta.tiempo}</span>
          {!respuesta.eliminado && (
            <ComunidadReactionButton
              tipo="respuesta"
              objetivoId={respuesta.id}
              ruta={ruta}
              meReaccione={respuesta.meReaccione}
              totalReacciones={respuesta.totalReacciones}
              usuarioActualId={usuarioActualId}
            />
          )}
          {puedeEliminar && (
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              className={`ml-auto ${CLASE_BOTON_ACCION_COMUNIDAD}`}
            >
              Eliminar
            </button>
          )}
        </div>
      </div>

      {puedeEliminar && (
        <ConfirmDialog
          open={confirmandoEliminar}
          onOpenChange={setConfirmandoEliminar}
          title="Eliminar respuesta"
          description="En su lugar quedará «[respuesta eliminada]». Esta acción no se puede deshacer."
          onConfirm={eliminar}
        />
      )}
    </div>
  );
}
