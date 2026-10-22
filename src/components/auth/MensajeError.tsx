import type { ReactNode } from "react";

/**
 * Error del login, debajo del campo al que se refiere (Login lab 7). El
 * círculo con "!" hace que no dependa solo del color. `uva-danger-text` es
 * #C2005B en claro y #FF7AB8 en oscuro: AA sobre la tarjeta en los dos.
 */
export function MensajeError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      role="alert"
      className="flex items-start gap-2 text-uva-detalle font-semibold text-uva-danger-text muy-bajo:leading-snug"
    >
      <span
        aria-hidden="true"
        className="mt-px grid size-5 flex-none place-items-center rounded-full border-2 border-current text-uva-detalle leading-none"
      >
        !
      </span>
      <span>{children}</span>
    </p>
  );
}
