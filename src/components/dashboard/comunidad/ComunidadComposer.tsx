"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorTextoEnriquecido, type EditorTextoEnriquecidoHandle } from "@/components/editor/EditorTextoEnriquecido";
import { crearPostComunidad } from "@/actions/comunidad/crear";
import { CATEGORIA_LABEL, CATEGORIA_ESTILO, armarFormDataAdjuntos, type CategoriaComunidad } from "@/lib/comunidad-tipos";
import { cn } from "@/lib/utils";

/**
 * Composer de una nueva publicación. El contenido usa `EditorTextoEnriquecido`
 * (negrita/cursiva/subrayado/listas/adjuntos — mismo componente base que los
 * comentarios de clase para el formato de texto, con el botón de adjuntar
 * agregado solo acá): sigue siendo el mismo `string` plano de siempre para
 * `crearPostComunidad` (Zod), solo que ahora con marcadores de formato y de
 * adjunto en vez de texto sin estilo.
 *
 * La categoría ya no se elige acá: la decide `ComunidadFeedContent` según
 * la pestaña donde esté parado el usuario (publicar en "Empleo" publica en
 * Empleo) y se muestra solo como una insignia informativa, no como un
 * `<Select>` — quien quiera publicar en otra categoría cambia de pestaña.
 */
export function ComunidadComposer({ ruta, categoria }: { ruta: string; categoria: CategoriaComunidad }) {
  const router = useRouter();
  const [expandido, setExpandido] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [contenidoVacio, setContenidoVacio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<EditorTextoEnriquecidoHandle>(null);

  function publicar() {
    const contenido = editorRef.current?.obtenerTexto() ?? "";
    const adjuntos = armarFormDataAdjuntos(editorRef.current?.obtenerAdjuntosPendientes() ?? new Map());
    setError(null);
    startTransition(async () => {
      const resultado = await crearPostComunidad(categoria, titulo, contenido, ruta, adjuntos);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setTitulo("");
      editorRef.current?.limpiar();
      setContenidoVacio(true);
      setExpandido(false);
      router.refresh();
    });
  }

  if (!expandido) {
    return (
      <button
        id="comunidad-composer-trigger"
        type="button"
        onClick={() => setExpandido(true)}
        className="w-full rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-3 text-left text-sm text-uva-text-faint transition-colors hover:border-uva-text-faint"
      >
        ¿Qué quieres compartir con la comunidad?
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface p-4">
      <span
        className={cn(
          "inline-flex h-5 w-fit items-center rounded-4xl px-2 text-xs font-semibold",
          CATEGORIA_ESTILO[categoria],
        )}
      >
        Publicando en {CATEGORIA_LABEL[categoria]}
      </span>

      <Input
        aria-label="Título"
        placeholder="Título"
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        maxLength={150}
      />
      <EditorTextoEnriquecido
        ref={editorRef}
        placeholder="Cuéntale a la comunidad..."
        onCambiar={setContenidoVacio}
        onErrorAdjunto={setError}
      />

      {error && <p className="text-sm text-uva-error">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="uva-secondary"
          className="w-auto px-4"
          onClick={() => setExpandido(false)}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="uva-primary"
          className="w-auto px-6"
          onClick={publicar}
          disabled={pending || !titulo.trim() || contenidoVacio}
        >
          {pending ? "Publicando…" : "Publicar"}
        </Button>
      </div>
    </div>
  );
}
