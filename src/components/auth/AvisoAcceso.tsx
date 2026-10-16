import type { ReactNode } from "react";
import { FichaOk } from "@/components/auth/FichaOk";

/**
 * Aviso de estado del registro y la confirmación de correo (Crear cuenta lab
 * 6, `.aviso`): un ícono a la izquierda y el texto, entre dos líneas.
 * `ok` = ✓ amarillo, `correo` = sobre amarillo, `alerta` = "!" en el color de
 * error (y `role="alert"` en vez de `status`).
 */
export function AvisoAcceso({
  icono,
  children,
}: {
  icono: "ok" | "correo" | "alerta";
  children: ReactNode;
}) {
  return (
    <div
      role={icono === "alerta" ? "alert" : "status"}
      className="flex items-start gap-3 border-y border-uva-divider py-3.5 text-uva-cuerpo text-uva-text bajo:py-3"
    >
      {icono === "ok" && <FichaOk />}
      {icono === "correo" && (
        <span
          aria-hidden="true"
          className="grid size-6 flex-none place-items-center rounded-full bg-uva-accent-2 text-uva-on-bright"
        >
          <svg
            viewBox="0 0 24 24"
            className="size-[13px]"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3.5 6.5h17v11h-17zM3.5 7.5l8.5 6 8.5-6" />
          </svg>
        </span>
      )}
      {icono === "alerta" && (
        <span
          aria-hidden="true"
          className="grid size-6 flex-none place-items-center rounded-full border-2 border-uva-danger-text text-uva-detalle font-extrabold text-uva-danger-text"
        >
          !
        </span>
      )}
      <span className="min-w-0">{children}</span>
    </div>
  );
}
