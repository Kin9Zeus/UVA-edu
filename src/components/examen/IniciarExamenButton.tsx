"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
      <Button
        type="button"
        variant="primary"
        className="w-full sm:w-fit"
        disabled={pending}
        onClick={handleIniciar}
      >
        {pending ? "Preparando examen…" : etiqueta}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] text-uva-error">
          {error}
        </p>
      )}
    </div>
  );
}
