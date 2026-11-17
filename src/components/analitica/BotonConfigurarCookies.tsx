"use client";

import { EVENTO_ABRIR_AVISO_COOKIES } from "@/lib/consentimiento";

/**
 * Vuelve a abrir el aviso de cookies (`Analitica.tsx`) para cambiar la
 * decisión: retirar el consentimiento debe ser tan fácil como darlo. Solo se
 * pinta si la analítica está encendida (lo decide el pie).
 */
export function BotonConfigurarCookies({ className }: { className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_AVISO_COOKIES))}
    >
      Configurar cookies
    </button>
  );
}
