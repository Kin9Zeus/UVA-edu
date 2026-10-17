"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { iniciarIntento } from "@/actions/examenes/intento";

/**
 * Único punto que abre un intento. El botón se bloquea mientras la acción
 * corre porque un doble clic es exactamente el escenario que gastaría dos de
 * los tres intentos del estudiante (la base lo impide con el índice parcial
 * `intentos_examen_uno_en_curso`, esto evita que llegue siquiera a intentarlo).
 */
export function IniciarExamenButton({
  cursoId,
  cursoSlug,
  etiqueta,
}: {
  cursoId: string;
  cursoSlug: string;
  etiqueta: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleIniciar() {
    setPending(true);
    setError(null);
    const resultado = await iniciarIntento(cursoId);

    if (resultado.error) {
      setPending(false);
      setError(resultado.error);
      return;
    }

    // No se baja `setPending`: la navegación desmonta el componente y dejar
    // el botón activo en el intervalo permitiría un segundo clic.
    router.replace(`/cursos/${cursoSlug}/examen`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={handleIniciar}
        className="inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-uva-md border-0 bg-uva-btn px-6 text-uva-lead font-semibold text-uva-on-accent hover:bg-uva-btn-hover disabled:cursor-wait disabled:opacity-80"
      >
        {pending ? (
          <>
            <Loader2 className="size-5 animate-spin" strokeWidth={2.2} aria-hidden />
            Preparando examen…
          </>
        ) : (
          <>
            {etiqueta}
            <ArrowRight className="size-5" strokeWidth={2} aria-hidden />
          </>
        )}
      </button>
      {error && (
        <p role="alert" className="m-0 text-uva-detalle text-uva-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
