"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  actualizarLeccion,
  eliminarRecursoLeccion,
  subirRecursoLeccion,
} from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import { formatTamanoArchivo, formatHoras } from "@/lib/admin/format";
import { VideoUploader } from "@/components/admin/cursos/VideoUploader";
import type { LeccionDetalle, RecursoDetalle } from "@/lib/admin/cursoDetalle";
import { RichTextEditor } from "@/components/editor/RichTextEditor";
import type { DocumentoContenido } from "@/lib/editor/tipos";

type CambiosLeccion = Pick<
  LeccionDetalle,
  "titulo" | "duracion" | "contenido" | "estadoProcesamiento" | "errorProcesamiento" | "idVideoMux"
>;

// Mismo valor que TAMANO_MAXIMO_RECURSO en actions/admin/cursos.ts. No se
// puede importar desde ahí: ese módulo tiene "use server" a nivel de
// archivo, así que solo puede exportar funciones async.
const TAMANO_MAXIMO_RECURSO = 50 * 1024 * 1024;

/**
 * Editor de lección de la pestaña Contenido. ModuloCard lo monta en línea,
 * justo debajo de la fila de la lección elegida (dentro de su propio
 * módulo), a todo el ancho del módulo — no en un panel aparte.
 *
 * Deviación deliberada del mockup (`design-spec/project/Uva - Panel
 * Admin.dc.html`, líneas 283-286): ahí el editor vive en una columna sticky
 * de 260-340px, con "Contenido de la clase" al final de una sola columna
 * apilada. En ese ancho el resumen quedaba ilegible — un editor de texto
 * enriquecido a 300px de ancho, con apenas 160-420px de alto. Acá, al ancho
 * completo, este componente separa los campos cortos (columna izquierda) del
 * contenido (columna derecha, con más alto).
 *
 * El formulario se remonta con `key={leccion.id}` desde ModuloCard, así los
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
  // Solo lectura: la sincroniza el webhook de Mux (video.asset.ready), no
  // este formulario. Se sigue actualizando en vivo cuando VideoUploader
  // reporta un nuevo `duracion` tras terminar de procesar (ver más abajo).
  const [duracion, setDuracion] = useState(leccion.duracion);
  const [contenido, setContenido] = useState<DocumentoContenido | null>(leccion.contenido);
  // Lo último que quedó guardado en el servidor. NO es `leccion` (esa prop
  // es la foto del momento en que este panel se montó): después de guardar
  // hay que comparar contra el guardado más reciente, no contra el original.
  const [guardadoComo, setGuardadoComo] = useState({
    titulo: leccion.titulo,
    contenido: leccion.contenido,
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
    titulo !== guardadoComo.titulo ||
    JSON.stringify(contenido) !== JSON.stringify(guardadoComo.contenido);

  /**
   * RichTextEditor llama esto una sola vez, apenas Tiptap termina de montar,
   * con el JSON ya normalizado por ProseMirror (ver el comentario de
   * `onReady` ahí). Sin esto, `guardadoComo.contenido` quedaba con el JSON
   * crudo de `leccion.contenido` mientras `contenido` pasaba a tener la
   * versión normalizada apenas el editor montaba — dos formas del mismo
   * documento, sin ninguna edición real, que el `JSON.stringify` de arriba
   * comparaba como distintas: el aviso de "cambios sin guardar" salía con
   * solo abrir la lección.
   */
  function handleContenidoListo(normalizado: DocumentoContenido) {
    setContenido(normalizado);
    setGuardadoComo((actual) => ({ ...actual, contenido: normalizado }));
  }

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
    const cambios = { titulo, contenido };
    const resultado = await actualizarLeccion(leccion.id, cursoId, cambios);
    setPending(false);

    if (resultado.error) {
      setError(resultado.error);
      return;
    }
    showToast("Lección guardada.");
    setGuardadoComo({ titulo, contenido });
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
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
        {/* Columna de campos cortos: ancho fijo en pantallas grandes para que
            "Contenido de la clase" se quede con el resto del panel ancho. */}
        <div className="flex flex-col gap-3 lg:w-[300px] lg:shrink-0">
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
                  setDuracion(cambios.duracion);
                  onGuardado(cambios);
                }}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="leccion-duracion">Duración</Label>
            <div
              id="leccion-duracion"
              className="flex h-9 items-center rounded-uva-md border border-uva-divider bg-uva-surface px-3 text-sm text-uva-text-muted"
            >
              {duracion != null
                ? formatHoras(duracion)
                : video.estadoProcesamiento === "LISTO"
                  ? "—"
                  : "Se calcula al terminar de procesar el video"}
            </div>
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
        </div>

        {/* Columna de contenido: se lleva el resto del ancho del panel y un
            alto bastante mayor al bloque de 160-420px que tenía en la
            columna angosta original. */}
        <div className="flex flex-1 flex-col">
          <Label>Contenido de la clase</Label>
          <RichTextEditor
            initialContent={leccion.contenido}
            onChange={setContenido}
            onReady={handleContenidoListo}
            placeholder="Escribe el resumen/teoría de esta clase…"
            contentClassName="min-h-[220px] max-h-[420px] lg:min-h-[420px] lg:max-h-[640px]"
          />
        </div>
      </div>

      <Button type="button" variant="primary" className="lg:self-end" onClick={handleGuardar} disabled={pending}>
        {pending ? "Guardando…" : "Guardar cambios"}
      </Button>
    </div>
  );
}
