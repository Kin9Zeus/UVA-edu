"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  actualizarLeccion,
  eliminarRecursoLeccion,
  subirRecursoLeccion,
} from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import { formatTamanoArchivo } from "@/lib/admin/format";
import { VideoUploader } from "@/components/admin/cursos/VideoUploader";
import type { LeccionDetalle, RecursoDetalle } from "@/lib/admin/cursoDetalle";

type CambiosLeccion = Pick<
  LeccionDetalle,
  "titulo" | "duracion" | "resumen" | "estadoProcesamiento" | "errorProcesamiento" | "idVideoMux"
>;

// Mismo valor que TAMANO_MAXIMO_RECURSO en actions/admin/cursos.ts. No se
// puede importar desde ahí: ese módulo tiene "use server" a nivel de
// archivo, así que solo puede exportar funciones async.
const TAMANO_MAXIMO_RECURSO = 50 * 1024 * 1024;

/**
 * Editor de lección del mockup del panel admin: NO es un modal, es la columna
 * derecha fija de la pestaña Contenido (`position:sticky;top:88px`). Se monta
 * dentro de la tarjeta que ContenidoTab deja siempre visible.
 *
 * El formulario se remonta con `key={leccion.id}` desde ContenidoTab, así los
 * campos arrancan con los valores de la lección elegida sin sincronizar estado
 * desde un efecto.
 */
export function LeccionEditorPanel({
  leccion,
  cursoId,
  onCerrar,
  onGuardado,
  onRecursosChange,
  onDirtyChange,
}: {
  leccion: LeccionDetalle;
  cursoId: string;
  onCerrar: () => void;
  onGuardado: (cambios: Partial<CambiosLeccion>) => void;
  onRecursosChange: (recursos: RecursoDetalle[]) => void;
  /** Avisa cada vez que título/duración/resumen dejan de coincidir con lo
   * último guardado, para que ContenidoTab pueda confirmar antes de
   * cambiar de lección o cerrar el editor. */
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [titulo, setTitulo] = useState(leccion.titulo);
  const [duracion, setDuracion] = useState(leccion.duracion?.toString() ?? "");
  const [resumen, setResumen] = useState(leccion.resumen ?? "");
  // Lo último que quedó guardado en el servidor. NO es `leccion` (esa prop
  // es la foto del momento en que este panel se montó): después de guardar
  // hay que comparar contra el guardado más reciente, no contra el original.
  const [guardadoComo, setGuardadoComo] = useState({
    titulo: leccion.titulo,
    duracion: leccion.duracion?.toString() ?? "",
    resumen: leccion.resumen ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [recursos, setRecursos] = useState(leccion.recursos);
  const [subiendoRecurso, setSubiendoRecurso] = useState(false);
  const [video, setVideo] = useState({
    estadoProcesamiento: leccion.estadoProcesamiento,
    errorProcesamiento: leccion.errorProcesamiento,
    idVideoMux: leccion.idVideoMux,
  });
  const inputArchivoRef = useRef<HTMLInputElement>(null);
  const showToast = useAdminToast();

  const sinGuardar =
    titulo !== guardadoComo.titulo || duracion !== guardadoComo.duracion || resumen !== guardadoComo.resumen;

  useEffect(() => {
    onDirtyChange(sinGuardar);
  }, [sinGuardar, onDirtyChange]);

  // Cierre de pestaña, recarga o navegación fuera de la app: el cambio de
  // lección DENTRO del panel (botón "Cerrar" o seleccionar otra) lo cubre
  // ContenidoTab con un confirm() propio, porque beforeunload no dispara en
  // esos casos (son navegación de cliente de Next, no salida real).
  useEffect(() => {
    function avisar(event: BeforeUnloadEvent) {
      if (!sinGuardar) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sinGuardar]);

  async function handleGuardar() {
    setPending(true);
    setError(null);
    const cambios = {
      titulo,
      duracion: duracion ? Number(duracion) : null,
      resumen,
    };
    const resultado = await actualizarLeccion(leccion.id, cursoId, cambios);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Lección guardada.");
    setGuardadoComo({ titulo, duracion, resumen });
    onGuardado(cambios);
  }

  async function handleSubirRecurso(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    // Mismo límite que TAMANO_MAXIMO_RECURSO en actions/admin/cursos.ts:
    // se valida antes de subir para no gastar el viaje al servidor (y no
    // chocar con bodySizeLimit de Server Actions, next.config.ts) con un
    // archivo que ya sabemos que el backend va a rechazar.
    if (archivo.size > TAMANO_MAXIMO_RECURSO) {
      showToast("El archivo no puede superar los 50 MB.", "error");
      return;
    }

    setSubiendoRecurso(true);
    try {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const resultado = await subirRecursoLeccion(leccion.id, cursoId, formData);

      if (resultado.error || !resultado.recurso) {
        showToast(resultado.error ?? "No pudimos subir el archivo.", "error");
        return;
      }
      const actualizados = [...recursos, resultado.recurso];
      setRecursos(actualizados);
      onRecursosChange(actualizados);
      showToast("Material adicional agregado.");
    } catch {
      showToast("No pudimos subir el archivo.", "error");
    } finally {
      setSubiendoRecurso(false);
    }
  }

  async function handleEliminarRecurso(recurso: RecursoDetalle) {
    const actualizados = recursos.filter((item) => item.id !== recurso.id);
    setRecursos(actualizados);
    onRecursosChange(actualizados);

    const resultado = await eliminarRecursoLeccion(recurso.id, cursoId);
    if (resultado.error) {
      showToast(resultado.error, "error");
      setRecursos(recursos);
      onRecursosChange(recursos);
      return;
    }
    showToast("Material eliminado.");
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center">
        <h4 className="font-heading text-[14.5px] font-bold tracking-[-0.02em] text-uva-text">
          Editor de lección
        </h4>
        <Button
          type="button"
          variant="ghost"
          size="auto"
          aria-label="Cerrar el editor de lección"
          className="ml-auto px-2 py-1 text-uva-muted-2 hover:text-uva-text"
          onClick={onCerrar}
        >
          <X className="size-4" />
        </Button>
      </div>

      {error && (
        <div role="alert" className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text">
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="leccion-nombre">Nombre</Label>
        <Input id="leccion-nombre" value={titulo} onChange={(event) => setTitulo(event.target.value)} />
      </div>

      <div>
        <Label htmlFor="leccion-tipo">Tipo de contenido</Label>
        {/* Por ahora toda lección es un video: el esquema no distingue tipos
            de contenido todavía (mismo criterio que el comentario en
            ModuloCard.tsx), así que se muestra fijo en vez de un selector con
            opciones que no hacen nada. */}
        <div
          id="leccion-tipo"
          className="flex h-9 items-center rounded-uva-md border border-uva-divider bg-uva-surface px-3 text-sm text-uva-text"
        >
          Video
        </div>
      </div>

      <div>
        <Label htmlFor="leccion-video">Video</Label>
        <div id="leccion-video">
          <VideoUploader
            leccionId={leccion.id}
            cursoId={cursoId}
            titulo={titulo}
            estadoProcesamiento={video.estadoProcesamiento}
            errorProcesamiento={video.errorProcesamiento}
            idMuxUploadId={leccion.idMuxUploadId}
            idVideoMux={video.idVideoMux}
            onEstadoChange={(cambios) => {
              setVideo(cambios);
              if (cambios.duracion != null) setDuracion(cambios.duracion.toString());
              onGuardado(cambios);
            }}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="leccion-duracion">Duración (segundos)</Label>
        <Input
          id="leccion-duracion"
          type="number"
          value={duracion}
          onChange={(event) => setDuracion(event.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center">
          <Label className="mb-0">Material adicional</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Agregar material adicional"
            title="Agregar material adicional"
            className="ml-auto text-uva-muted-2 hover:text-uva-accent pointer-coarse:p-3.5"
            disabled={subiendoRecurso}
            onClick={() => inputArchivoRef.current?.click()}
          >
            <Plus className="size-3.5" />
          </Button>
          <input
            ref={inputArchivoRef}
            type="file"
            className="hidden"
            onChange={handleSubirRecurso}
          />
        </div>

        {recursos.length === 0 && !subiendoRecurso && (
          <p className="mt-1.5 text-xs text-uva-muted-2">Sin materiales adicionales todavía.</p>
        )}

        {recursos.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {recursos.map((recurso) => (
              <li
                key={recurso.id}
                className="flex items-center gap-2 rounded-uva-md border border-uva-divider px-2.5 py-1.5"
              >
                <span className="flex-1 truncate text-xs text-uva-text">{recurso.nombre}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-uva-muted-2">
                  {formatTamanoArchivo(recurso.tamanoBytes)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Eliminar ${recurso.nombre}`}
                  title="Eliminar material"
                  className="shrink-0 text-uva-muted-2 hover:text-uva-accent pointer-coarse:p-3.5"
                  onClick={() => handleEliminarRecurso(recurso)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}

        {subiendoRecurso && <p className="mt-1.5 text-xs text-uva-muted-2">Subiendo…</p>}
      </div>

      <div>
        <Label htmlFor="leccion-resumen">Resumen</Label>
        <Textarea
          id="leccion-resumen"
          value={resumen}
          onChange={(event) => setResumen(event.target.value)}
          rows={3}
        />
      </div>

      <Button type="button" variant="primary" onClick={handleGuardar} disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
