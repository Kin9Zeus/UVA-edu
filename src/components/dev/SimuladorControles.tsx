"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { simularPago } from "@/actions/suscripciones/simular-pago";

/**
 * Los dos desenlaces que Wompi puede darle a una transacción, como botones.
 *
 * Rechazar importa tanto como aprobar: es el caso en el que NO se debe tocar
 * el acceso, y el que deja al estudiante en una pantalla que tiene que
 * explicarle qué pasó.
 */
export function SimuladorControles({
  referencia,
  montoCentavos,
  moneda,
  urlRetorno,
}: {
  referencia: string;
  montoCentavos: number;
  moneda: string;
  urlRetorno: string;
}) {
  const [enCurso, setEnCurso] = useState<"aprobar" | "rechazar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function emitir(aprobar: boolean) {
    setEnCurso(aprobar ? "aprobar" : "rechazar");
    setError(null);

    const resultado = await simularPago(referencia, montoCentavos, moneda, aprobar, urlRetorno);

    // Solo se vuelve de la acción si NO hubo redirect, o sea si algo falló.
    setEnCurso(null);
    if (resultado?.error) setError(resultado.error);
  }

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        variant="uva-primary"
        size="uva"
        onClick={() => emitir(true)}
        disabled={enCurso !== null}
      >
        {enCurso === "aprobar" ? "Enviando webhook…" : "Aprobar el pago"}
      </Button>

      <Button
        type="button"
        variant="uva-secondary"
        size="uva"
        onClick={() => emitir(false)}
        disabled={enCurso !== null}
      >
        {enCurso === "rechazar" ? "Enviando webhook…" : "Rechazar el pago"}
      </Button>

      {error && (
        <p
          role="alert"
          className="m-0 rounded-uva-md bg-uva-error-soft px-3 py-2 text-[12.5px] text-uva-error-text"
        >
          {error}
        </p>
      )}
    </div>
  );
}
