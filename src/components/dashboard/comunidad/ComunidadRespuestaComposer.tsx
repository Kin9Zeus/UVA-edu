"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EditorTextoEnriquecido, type EditorTextoEnriquecidoHandle } from "@/components/editor/EditorTextoEnriquecido";
import { responderPostComunidad } from "@/actions/comunidad/crear";
import { armarFormDataAdjuntos } from "@/lib/comunidad-tipos";

/** Igual que `ComunidadComposer`: un placeholder que abre el editor, y el
 * mismo botón que lo abrió (o "Cancelar" dentro) lo vuelve a cerrar — no se
 * queda expandido para siempre una vez usado. */
export function ComunidadRespuestaComposer({ postId, ruta }: { postId: string; ruta: string }) {
  const router = useRouter();
  const [expandido, setExpandido] = useState(false);
  const [contenidoVacio, setContenidoVacio] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorRef = useRef<EditorTextoEnriquecidoHandle>(null);

  function publicar() {
    const contenido = editorRef.current?.obtenerTexto() ?? "";
    const adjuntos = armarFormDataAdjuntos(editorRef.current?.obtenerAdjuntosPendientes() ?? new Map());
    setError(null);
    startTransition(async () => {
      const resultado = await responderPostComunidad(postId, contenido, ruta, adjuntos);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      editorRef.current?.limpiar();
      setContenidoVacio(true);
      setExpandido(false);
      router.refresh();
    });
  }

  if (!expandido) {
    return (
      <button
        type="button"
        onClick={() => setExpandido(true)}
        className="w-full border-t border-uva-divider py-4 text-left text-sm text-uva-text-faint transition-colors hover:text-uva-text-muted"
      >
        Responder…
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-uva-divider pt-4">
      <EditorTextoEnriquecido
        ref={editorRef}
        placeholder="Escribe una respuesta..."
        autoFocus
        alturaMinima="min-h-16"
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
          disabled={pending || contenidoVacio}
        >
          {pending ? "Enviando…" : "Responder"}
        </Button>
      </div>
    </div>
  );
}
