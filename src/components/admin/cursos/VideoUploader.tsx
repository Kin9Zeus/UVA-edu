"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { VideoPlayer } from "@/components/features/VideoPlayer";
import {
  contarProgresoLeccion,
  iniciarSubidaVideoLeccion,
  obtenerEstadoProcesamientoLeccion,
} from "@/actions/admin/mux";
import type { EstadoProcesamiento } from "@/actions/admin/mux";

const INTERVALO_POLLING_MS = 4000;

type EstadoLocal =
  | { fase: "inactivo" }
  | { fase: "subiendo"; porcentaje: number }
  | { fase: "procesando" }
  | { fase: "error"; mensaje: string };

function subirArchivoAMux(url: string, archivo: File, onProgreso: (porcentaje: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", archivo.type || "video/mp4");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgreso(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Mux respondió con el estado ${xhr.status}.`));
    };
    xhr.onerror = () => reject(new Error("Error de red subiendo el video."));
    xhr.send(archivo);
  });
}

/**
 * Zona de carga de video de la lección (Flujo 09/10, functional-spec.md).
 * El archivo nunca pasa por nuestro servidor: `iniciarSubidaVideoLeccion`
 * solo pide a Mux la URL de subida, y el PUT del binario va directo del
 * navegador a Mux. Mientras Mux procesa no hay un evento intermedio (el
 * webhook solo distingue "ready"/"errored"/"cancelled"), así que el estado
 * "Procesando" se resuelve con polling corto sobre la fila de la lección.
 */
export function VideoUploader({
  leccionId,
  cursoId,
  estadoProcesamiento,
  errorProcesamiento,
  idMuxUploadId,
  idVideoMux,
  titulo,
  onEstadoChange,
}: {
  leccionId: string;
  cursoId: string;
  estadoProcesamiento: EstadoProcesamiento;
  errorProcesamiento: string | null;
  idMuxUploadId: string | null;
  idVideoMux: string | null;
  titulo: string;
  onEstadoChange: (cambios: {
    estadoProcesamiento: EstadoProcesamiento;
    errorProcesamiento: string | null;
    idVideoMux: string | null;
    duracion: number | null;
  }) => void;
}) {
  const [local, setLocal] = useState<EstadoLocal>({ fase: "inactivo" });
  const [confirmandoReemplazo, setConfirmandoReemplazo] = useState<{ totalEstudiantes: number } | null>(
    null,
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function detenerPolling() {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }

  useEffect(() => () => detenerPolling(), []);

  function iniciarPolling() {
    detenerPolling();
    pollingRef.current = setInterval(async () => {
      const resultado = await obtenerEstadoProcesamientoLeccion(leccionId);
      if (resultado.error || !resultado.estadoProcesamiento) return;

      if (resultado.estadoProcesamiento === "LISTO" || resultado.estadoProcesamiento === "ERROR") {
        detenerPolling();
        setLocal({ fase: "inactivo" });
      }
      onEstadoChange({
        estadoProcesamiento: resultado.estadoProcesamiento,
        errorProcesamiento: resultado.errorProcesamiento ?? null,
        idVideoMux: resultado.idVideoMux ?? null,
        duracion: resultado.duracion ?? null,
      });
    }, INTERVALO_POLLING_MS);
  }

  async function handleArchivoElegido(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    if (!archivo.type.startsWith("video/")) {
      setLocal({ fase: "error", mensaje: "Selecciona un archivo de video." });
      return;
    }

    setLocal({ fase: "subiendo", porcentaje: 0 });

    const inicio = await iniciarSubidaVideoLeccion(leccionId, cursoId);
    if (inicio.error || !inicio.uploadUrl) {
      setLocal({ fase: "error", mensaje: inicio.error ?? "No pudimos iniciar la subida." });
      return;
    }
    // Mux ya limpió cualquier estado anterior (id_mux_asset_id, error) al
    // crear este upload; reflejarlo también localmente para que el resto
    // del panel dejemos de mostrar el video/errores del intento previo.
    onEstadoChange({
      estadoProcesamiento: "SUBIENDO",
      errorProcesamiento: null,
      idVideoMux,
      duracion: null,
    });

    try {
      await subirArchivoAMux(inicio.uploadUrl, archivo, (porcentaje) =>
        setLocal({ fase: "subiendo", porcentaje }),
      );
    } catch (error) {
      setLocal({
        fase: "error",
        mensaje: error instanceof Error ? error.message : "No pudimos subir el video.",
      });
      return;
    }

    setLocal({ fase: "procesando" });
    iniciarPolling();
  }

  function handleElegirArchivo() {
    inputRef.current?.click();
  }

  /**
   * Solo para el botón "Reemplazar video" (hay un video LISTO de por
   * medio): a diferencia de la primera subida o un reintento tras error,
   * acá sí puede haber estudiantes con progreso registrado que el
   * reemplazo va a afectar (se les reinicia el segundo de reanudación, ver
   * video.asset.ready en src/app/api/webhooks/mux/route.ts). Si no hay
   * ninguno, no tiene sentido interrumpir con un diálogo vacío.
   */
  async function handleClickReemplazar() {
    const resultado = await contarProgresoLeccion(leccionId);
    if (resultado.total) {
      setConfirmandoReemplazo({ totalEstudiantes: resultado.total });
      return;
    }
    handleElegirArchivo();
  }

  const inputOculto = (
    <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={handleArchivoElegido} />
  );

  const dialogoConfirmarReemplazo = confirmandoReemplazo && (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && setConfirmandoReemplazo(null)}
      title="Reemplazar video"
      description={
        <>
          {confirmandoReemplazo.totalEstudiantes === 1
            ? "1 estudiante tiene"
            : `${confirmandoReemplazo.totalEstudiantes} estudiantes tienen`}{" "}
          progreso registrado en esta lección. Al reemplazar el video se reinicia su punto de
          reanudación; la marca de &quot;completada&quot; no se pierde.
        </>
      }
      confirmLabel="Reemplazar video"
      onConfirm={() => {
        setConfirmandoReemplazo(null);
        handleElegirArchivo();
      }}
    />
  );

  // Prioridad: lo que está pasando EN ESTA sesión del navegador (local) por
  // encima de lo último que sabíamos por props/polling — así el porcentaje
  // de subida no se pisa con un estado desactualizado.
  if (local.fase === "subiendo") {
    return (
      <div className="rounded-uva-md border border-uva-divider bg-uva-surface px-3.5 py-3">
        {inputOculto}
        <div className="flex items-center justify-between text-xs text-uva-muted-2">
          <span>Subiendo video…</span>
          <span className="font-mono">{local.porcentaje}%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-uva-divider">
          <div
            className="h-full rounded-full bg-uva-accent transition-[width]"
            style={{ width: `${local.porcentaje}%` }}
          />
        </div>
      </div>
    );
  }

  if (local.fase === "procesando" || (idMuxUploadId && estadoProcesamiento !== "LISTO" && estadoProcesamiento !== "ERROR")) {
    return (
      <div className="flex items-center justify-between rounded-uva-md border border-uva-divider bg-uva-surface px-3.5 py-3">
        {inputOculto}
        <div className="flex items-center gap-2">
          <StatusBadge tone="warning">Procesando</StatusBadge>
          <span className="text-xs text-uva-muted-2">Mux está preparando el video…</span>
        </div>
        <Button type="button" variant="ghost" size="xs" onClick={handleElegirArchivo}>
          Cancelar y reintentar
        </Button>
      </div>
    );
  }

  const mensajeError = local.fase === "error" ? local.mensaje : errorProcesamiento;
  if (mensajeError || estadoProcesamiento === "ERROR") {
    return (
      <div className="rounded-uva-md border border-uva-divider bg-uva-badge-danger-bg px-3.5 py-3">
        {inputOculto}
        <div className="flex items-center gap-2">
          <StatusBadge tone="error">Error</StatusBadge>
          <span className="flex-1 text-xs text-uva-badge-danger-fg">
            {mensajeError ?? "Mux no pudo procesar el video."}
          </span>
        </div>
        <Button type="button" variant="outline" size="sm" className="mt-2 gap-1.5" onClick={handleElegirArchivo}>
          <RotateCcw className="size-3.5" />
          Reintentar
        </Button>
      </div>
    );
  }

  if (estadoProcesamiento === "LISTO" && idVideoMux) {
    return (
      <div className="flex flex-col gap-2">
        {inputOculto}
        {dialogoConfirmarReemplazo}
        <VideoPlayer leccionId={leccionId} titulo={titulo} />
        <Button type="button" variant="outline" size="sm" onClick={handleClickReemplazar}>
          Reemplazar video
        </Button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleElegirArchivo}
      className="flex w-full flex-col items-center gap-1.5 rounded-uva-md border-[1.5px] border-dashed border-uva-divider px-3 py-5 text-center text-xs text-uva-muted-2 hover:border-uva-accent hover:text-uva-text"
    >
      {inputOculto}
      <UploadCloud className="size-5" />
      Arrastra tu video aquí o selecciona un archivo
    </button>
  );
}
