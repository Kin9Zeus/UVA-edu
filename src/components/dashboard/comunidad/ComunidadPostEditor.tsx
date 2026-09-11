"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorTextoEnriquecido, type EditorTextoEnriquecidoHandle } from "@/components/editor/EditorTextoEnriquecido";
import { editarPostComunidad } from "@/actions/comunidad/editar";
import { armarFormDataAdjuntos, type ComunidadPostResumen } from "@/lib/comunidad-tipos";

/**
 * Reemplaza el cuerpo de `ComunidadPostCard` mientras el autor edita su
 * propia publicación — mismo editor que el composer de creación, hidratado
 * con el texto y los adjuntos que el post ya tenía (`contenidoInicial`/
 * `etiquetaAdjuntoExistente` en `EditorTextoEnriquecido`), para poder
 * seguir escribiendo sobre lo mismo en vez de empezar de cero.
 */
export function ComunidadPostEditor({
  post,
  ruta,
  onCancelar,
  onGuardado,
}: {
  post: ComunidadPostResumen;
  ruta: string;
  onCancelar: () => void;
  onGuardado: () => void;
}) {
  const [titulo, setTitulo] = useState(post.titulo);
  const [contenidoVacio, setContenidoVacio] = useState(post.contenido.trim() === "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<EditorTextoEnriquecidoHandle>(null);
  const nombresPorId = new Map(post.adjuntos.map((adjunto) => [adjunto.id, adjunto.nombre]));

  function guardar() {
    const contenido = editorRef.current?.obtenerTexto() ?? "";
    const adjuntos = armarFormDataAdjuntos(editorRef.current?.obtenerAdjuntosPendientes() ?? new Map());
    setError(null);
    startTransition(async () => {
      const resultado = await editarPostComunidad(post.id, titulo, contenido, ruta, adjuntos);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      onGuardado();
    });
  }

  return (
    <div className="flex flex-col gap-3">
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
        contenidoInicial={post.contenido}
        etiquetaAdjuntoExistente={(id) => nombresPorId.get(id) ?? "archivo"}
        onCambiar={setContenidoVacio}
        onErrorAdjunto={setError}
      />

      {error && <p className="text-sm text-uva-error">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="uva-secondary" className="w-auto px-4" onClick={onCancelar} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="uva-primary"
          className="w-auto px-6"
          onClick={guardar}
          disabled={pending || !titulo.trim() || contenidoVacio}
        >
          {pending ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
