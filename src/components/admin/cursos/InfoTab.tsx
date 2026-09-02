"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SelectorCategorias } from "@/components/admin/cursos/SelectorCategorias";
import { SelectorInstructores } from "@/components/admin/cursos/SelectorInstructores";
import { subirPortadaCurso, type NivelCurso } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import {
  ACCEPT_PORTADA,
  ERROR_FORMATO_PORTADA,
  ERROR_TAMANO_PORTADA,
  FORMATOS_PORTADA,
  TAMANO_MAXIMO_PORTADA,
  esPortadaReal,
} from "@/lib/media";

const NIVEL_ITEMS = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

/**
 * Controlado desde CursoDetalleView: el guardado es compartido con
 * ConfiguracionTab a través de un solo botón en la cabecera (ver comentario
 * ahí), así que este tab no guarda su propio estado ni dispara la mutación.
 */
export function InfoTab({
  cursoId,
  titulo,
  onTituloChange,
  imagenPortada,
  onImagenPortadaChange,
  descripcion,
  onDescripcionChange,
  categoriaIds,
  onCategoriaIdsChange,
  nivel,
  onNivelChange,
  categorias,
  idsInstructores,
  onIdsInstructoresChange,
  instructores,
  error,
}: {
  cursoId: string;
  titulo: string;
  onTituloChange: (value: string) => void;
  imagenPortada: string;
  onImagenPortadaChange: (url: string) => void;
  descripcion: string;
  onDescripcionChange: (value: string) => void;
  categoriaIds: string[];
  onCategoriaIdsChange: (ids: string[]) => void;
  nivel: NivelCurso;
  onNivelChange: (value: NivelCurso) => void;
  categorias: { id: string; nombre: string }[];
  idsInstructores: string[];
  onIdsInstructoresChange: (ids: string[]) => void;
  /** Cuentas con rol PROFESOR (getPerfilesProfesor). Puede venir vacía. */
  instructores: { id: string; nombre: string }[];
  error: string | null;
}) {
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [errorPortada, setErrorPortada] = useState<string | null>(null);
  // Elegir un archivo no lo sube: queda acá en memoria y se previsualiza
  // hasta que el administrador confirme. Reemplazar la portada de un curso
  // publicado es visible de inmediato en el catálogo, así que no debería
  // pasar por un clic accidental en el selector de archivos.
  const [portadaPendiente, setPortadaPendiente] = useState<File | null>(null);
  const inputPortadaRef = useRef<HTMLInputElement>(null);
  const showToast = useAdminToast();

  const previewPendiente = useMemo(
    () => (portadaPendiente ? URL.createObjectURL(portadaPendiente) : null),
    [portadaPendiente],
  );
  useEffect(() => {
    return () => {
      if (previewPendiente) URL.revokeObjectURL(previewPendiente);
    };
  }, [previewPendiente]);

  function handleSeleccionarPortada(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    // Un pre-chequeo para no gastar una subida en un archivo que el
    // servidor va a rechazar igual; la validación que manda es la de
    // procesarPortada(), que mira los magic bytes y no este `type`.
    if (!ACCEPT_PORTADA.split(",").includes(archivo.type)) {
      setErrorPortada(ERROR_FORMATO_PORTADA);
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_PORTADA) {
      setErrorPortada(ERROR_TAMANO_PORTADA);
      return;
    }

    setErrorPortada(null);
    setPortadaPendiente(archivo);
  }

  // Lo que se pinta en el recuadro: la imagen pendiente de confirmar si la
  // hay, si no la portada ya guardada, y si tampoco, nada (zona de arrastre).
  const fuenteVistaPrevia =
    previewPendiente ?? (esPortadaReal(imagenPortada) ? imagenPortada : null);

  function descartarPortadaPendiente() {
    setPortadaPendiente(null);
    setErrorPortada(null);
  }

  async function handleConfirmarPortada() {
    if (!portadaPendiente) return;

    setErrorPortada(null);
    setSubiendoPortada(true);
    try {
      const formData = new FormData();
      formData.set("archivo", portadaPendiente);
      const resultado = await subirPortadaCurso(cursoId, formData);

      if (resultado.error || !resultado.url) {
        setErrorPortada(resultado.error ?? "No pudimos subir la imagen.");
        return;
      }
      onImagenPortadaChange(resultado.url);
      setPortadaPendiente(null);
      showToast("Portada actualizada.");
    } catch {
      setErrorPortada("No pudimos subir la imagen.");
    } finally {
      setSubiendoPortada(false);
    }
  }

  return (
    // El mockup no envuelve esta pestaña en `.card`: es una columna suelta.
    <div className="flex max-w-[640px] flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
        >
          {error}
        </div>
      )}

      <div>
        <Label htmlFor="info-titulo">Nombre del curso</Label>
        <Input
          id="info-titulo"
          value={titulo}
          onChange={(event) => onTituloChange(event.target.value)}
        />
      </div>

      <div>
        <Label htmlFor="info-descripcion">Descripción</Label>
        <Textarea
          id="info-descripcion"
          value={descripcion}
          onChange={(event) => onDescripcionChange(event.target.value)}
          rows={5}
        />
      </div>

      <div>
        <Label>Portada</Label>
        {errorPortada && (
          <div
            role="alert"
            className="mb-2 rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
          >
            {errorPortada}
          </div>
        )}
        {/* El recuadro muestra la imagen pendiente si hay una; si no, la
            portada guardada. Es aspect-video + object-cover, el mismo
            encuadre 16:9 centrado que el servidor aplica al guardar, así
            que la vista previa no miente sobre el recorte. */}
        <button
          type="button"
          onClick={() => inputPortadaRef.current?.click()}
          disabled={subiendoPortada}
          className="block aspect-video w-full max-w-[280px] overflow-hidden rounded-uva-md border-[1.5px] border-dashed border-uva-divider text-center text-[13px] text-uva-muted-2 hover:border-uva-text-faint disabled:pointer-events-none disabled:opacity-60"
        >
          {fuenteVistaPrevia ? (
            // eslint-disable-next-line @next/next/no-img-element -- preview local (URL.createObjectURL) o imagen de Supabase Storage
            <img src={fuenteVistaPrevia} alt="" className="size-full object-cover" />
          ) : (
            <div className="flex size-full items-center justify-center px-4">
              Arrastra una imagen aquí o{" "}
              <span className="text-uva-accent">selecciona un archivo</span>
            </div>
          )}
        </button>

        {portadaPendiente ? (
          <div className="mt-2 flex items-center gap-2">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmarPortada}
              disabled={subiendoPortada}
            >
              {subiendoPortada ? "Subiendo…" : "Usar esta portada"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={descartarPortadaPendiente}
              disabled={subiendoPortada}
            >
              Descartar
            </Button>
          </div>
        ) : (
          esPortadaReal(imagenPortada) && (
            <p className="mt-1.5 text-xs text-uva-text-faint">
              Click en la imagen para reemplazarla.
            </p>
          )
        )}

        <p className="mt-1 text-xs text-uva-text-faint">
          {FORMATOS_PORTADA.join(", ")} hasta {TAMANO_MAXIMO_PORTADA / 1024 / 1024} MB. Se guarda
          recortada a 1280×720px (16:9), igual que la vista previa.
        </p>
        <input
          ref={inputPortadaRef}
          type="file"
          accept={ACCEPT_PORTADA}
          className="hidden"
          onChange={handleSeleccionarPortada}
        />
      </div>

      {/* items-start: la lista de categorías es más alta que el Select de
          nivel, y sin esto el grid estiraría el Select para igualarla. */}
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
        <div>
          <Label id="info-categorias-label">Categorías</Label>
          <SelectorCategorias
            id="info-categorias"
            categorias={categorias}
            seleccionadas={categoriaIds}
            onChange={onCategoriaIdsChange}
          />
        </div>
        <div>
          <Label htmlFor="info-nivel">Nivel</Label>
          <Select
            items={NIVEL_ITEMS}
            value={nivel}
            onValueChange={(value) => value && onNivelChange(value as NivelCurso)}
          >
            <SelectTrigger id="info-nivel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BASICO">Básico</SelectItem>
              <SelectItem value="INTERMEDIO">Intermedio</SelectItem>
              <SelectItem value="AVANZADO">Avanzado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        {/* Múltiple: `curso_instructores` es muchos-a-muchos. Editarlo aquí es
            nuevo — antes el instructor solo se elegía al crear el curso y no
            había forma de cambiarlo desde el panel. */}
        <Label id="info-instructores-label">Instructores</Label>
        <SelectorInstructores
          id="info-instructores"
          instructores={instructores}
          seleccionados={idsInstructores}
          onChange={onIdsInstructoresChange}
        />
      </div>
    </div>
  );
}
