"use client";

import { useMemo, useRef, useState } from "react";
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
import { subirPortadaCurso, type NivelCurso } from "@/actions/admin/cursos";
import { useAdminToast } from "@/components/admin/Toast";
import { esPortadaReal } from "@/lib/media";

const NIVEL_ITEMS = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
};

// Mismo valor que TAMANO_MAXIMO_PORTADA en actions/admin/cursos.ts. No se
// puede importar desde ahí: ese módulo tiene "use server" a nivel de
// archivo, así que solo puede exportar funciones async.
const TAMANO_MAXIMO_PORTADA = 5 * 1024 * 1024;

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
  categoriaId,
  onCategoriaIdChange,
  nivel,
  onNivelChange,
  categorias,
  error,
}: {
  cursoId: string;
  titulo: string;
  onTituloChange: (value: string) => void;
  imagenPortada: string;
  onImagenPortadaChange: (url: string) => void;
  descripcion: string;
  onDescripcionChange: (value: string) => void;
  categoriaId: string;
  onCategoriaIdChange: (value: string) => void;
  nivel: NivelCurso;
  onNivelChange: (value: NivelCurso) => void;
  categorias: { id: string; nombre: string }[];
  error: string | null;
}) {
  const categoriaItems = useMemo(
    () => Object.fromEntries(categorias.map((c) => [c.id, c.nombre])),
    [categorias],
  );
  const [subiendoPortada, setSubiendoPortada] = useState(false);
  const [errorPortada, setErrorPortada] = useState<string | null>(null);
  const inputPortadaRef = useRef<HTMLInputElement>(null);
  const showToast = useAdminToast();

  async function handleSubirPortada(event: React.ChangeEvent<HTMLInputElement>) {
    const archivo = event.target.files?.[0];
    event.target.value = "";
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      setErrorPortada("El archivo debe ser una imagen.");
      return;
    }
    if (archivo.size > TAMANO_MAXIMO_PORTADA) {
      setErrorPortada("La imagen no puede superar los 5 MB.");
      return;
    }

    setErrorPortada(null);
    setSubiendoPortada(true);
    try {
      const formData = new FormData();
      formData.set("archivo", archivo);
      const resultado = await subirPortadaCurso(cursoId, formData);

      if (resultado.error || !resultado.url) {
        setErrorPortada(resultado.error ?? "No pudimos subir la imagen.");
        return;
      }
      onImagenPortadaChange(resultado.url);
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
        <Label>Imagen / thumbnail</Label>
        {errorPortada && (
          <div
            role="alert"
            className="mb-2 rounded-uva-md bg-uva-error-soft px-3.5 py-2.5 text-sm text-uva-error-text"
          >
            {errorPortada}
          </div>
        )}
        <button
          type="button"
          onClick={() => inputPortadaRef.current?.click()}
          disabled={subiendoPortada}
          className="block w-full overflow-hidden rounded-uva-md border-[1.5px] border-dashed border-uva-divider text-center text-[13px] text-uva-muted-2 hover:border-uva-text-faint disabled:pointer-events-none disabled:opacity-60"
        >
          {esPortadaReal(imagenPortada) ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage
            <img src={imagenPortada} alt="" className="h-[140px] w-full object-cover" />
          ) : (
            <div className="px-4 py-[30px]">
              {subiendoPortada ? (
                "Subiendo…"
              ) : (
                <>
                  Arrastra una imagen aquí o <span className="text-uva-accent">selecciona un archivo</span>
                </>
              )}
            </div>
          )}
        </button>
        {esPortadaReal(imagenPortada) && (
          <p className="mt-1.5 text-xs text-uva-text-faint">
            {subiendoPortada ? "Subiendo…" : "Click en la imagen para reemplazarla."}
          </p>
        )}
        <input
          ref={inputPortadaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleSubirPortada}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="info-categoria">Categoría</Label>
          <Select
            items={categoriaItems}
            value={categoriaId}
            onValueChange={(value) => onCategoriaIdChange(value ?? "")}
          >
            <SelectTrigger id="info-categoria" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((categoria) => (
                <SelectItem key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
    </div>
  );
}
