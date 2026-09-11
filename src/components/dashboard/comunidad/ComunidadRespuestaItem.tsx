"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ComunidadReactionButton } from "@/components/dashboard/comunidad/ComunidadReactionButton";
import { ComunidadAdjuntoVista } from "@/components/dashboard/comunidad/ComunidadAdjuntoVista";
import { ModerarComunidadDialog } from "@/components/dashboard/comunidad/ModerarComunidadDialog";
import { ReportarComunidadDialog } from "@/components/dashboard/comunidad/ReportarComunidadDialog";
import { eliminarRespuestaComunidad } from "@/actions/comunidad/eliminar";
import { reportarComunidad } from "@/actions/comunidad/reportar";
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
  const [dialogoModeracionAbierto, setDialogoModeracionAbierto] = useState(false);
  const [dialogoReporteAbierto, setDialogoReporteAbierto] = useState(false);
  const esAutor = usuarioActualId === respuesta.autorId;
  const puedeEliminar = !respuesta.eliminado && (esAutor || esAdmin);
  const puedeReportar = !respuesta.eliminado && Boolean(usuarioActualId) && !esAutor && !esAdmin;

  async function confirmarReporte(motivo: string) {
    const resultado = await reportarComunidad({ idRespuesta: respuesta.id }, motivo);
    if ("error" in resultado) return { error: resultado.error };
    return {};
  }

  const adjuntosPorId = new Map(respuesta.adjuntos.map((adjunto) => [adjunto.id, adjunto]));
  function resolverAdjunto(id: string) {
    const adjunto = adjuntosPorId.get(id);
    return adjunto ? <ComunidadAdjuntoVista adjunto={adjunto} /> : null;
  }

  // Mismo criterio que ComunidadPostCard: el autor confirma (ConfirmDialog,
  // que sigue abierto con "Procesando…" hasta que esto termina) y un admin
  // moderando contenido ajeno tiene que escribir el motivo primero.
  async function eliminarPropia() {
    await eliminarRespuestaComunidad(respuesta.id, ruta);
    router.refresh();
  }

  async function confirmarEliminacionModerada(motivo: string) {
    const resultado = await eliminarRespuestaComunidad(respuesta.id, ruta, motivo);
    if ("error" in resultado) return { error: resultado.error };
    router.refresh();
    return {};
  }

  return (
    <div className="flex items-start gap-2.5 py-3">
      <Avatar className="size-7 shrink-0 bg-uva-divider">
        {respuesta.autorFotoUrl && <AvatarImage src={respuesta.autorFotoUrl} alt="" />}
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
          {respuesta.eliminado
            ? respuesta.eliminadoPorAdmin
              ? "[respuesta eliminada por un moderador]"
              : "[respuesta eliminada por su autor]"
            : renderizarTextoFormateado(respuesta.contenido, resolverAdjunto)}
        </div>
        {/* Misma fila que la de ComunidadPostCard: se parte sin cortar
            palabras y la acción va a la derecha. Eliminar y Reportar nunca
            salen juntos (reportar es para quien no puede eliminar). */}
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
              onClick={() => (esAutor ? setConfirmandoEliminar(true) : setDialogoModeracionAbierto(true))}
              className={`ml-auto ${CLASE_BOTON_ACCION_COMUNIDAD}`}
            >
              Eliminar
            </button>
          )}
          {puedeReportar && (
            <button
              type="button"
              onClick={() => setDialogoReporteAbierto(true)}
              className={`ml-auto ${CLASE_BOTON_ACCION_COMUNIDAD}`}
            >
              Reportar
            </button>
          )}
        </div>
      </div>

      {puedeEliminar && esAutor && (
        <ConfirmDialog
          open={confirmandoEliminar}
          onOpenChange={setConfirmandoEliminar}
          title="Eliminar respuesta"
          description="En su lugar quedará «[respuesta eliminada por su autor]». Esta acción no se puede deshacer."
          onConfirm={eliminarPropia}
        />
      )}
      {puedeEliminar && !esAutor && (
        <ModerarComunidadDialog
          open={dialogoModeracionAbierto}
          onOpenChange={setDialogoModeracionAbierto}
          tipoContenido="respuesta"
          onConfirm={confirmarEliminacionModerada}
        />
      )}
      {puedeReportar && (
        <ReportarComunidadDialog
          open={dialogoReporteAbierto}
          onOpenChange={setDialogoReporteAbierto}
          tipoContenido="respuesta"
          onConfirm={confirmarReporte}
        />
      )}
    </div>
  );
}
