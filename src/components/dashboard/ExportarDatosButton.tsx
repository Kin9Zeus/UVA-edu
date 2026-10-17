"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportarMisDatos } from "@/actions/perfil/exportar-datos";

/**
 * Botón de "Descargar mis datos" (P2-11, AUDIT-2026-09-15.md). La Server
 * Action solo arma el JSON con el cliente de sesión (RLS acota cada tabla a
 * lo propio); la descarga la dispara el navegador con un Blob — no se sube
 * a Storage ni se manda por correo, para no dejar una copia adicional del
 * dato en otro sitio.
 */
export function ExportarDatosButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setError(null);
    try {
      const resultado = await exportarMisDatos();
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }

      const blob = new Blob([resultado.datos], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = resultado.nombreArchivo;
      enlace.click();
      URL.revokeObjectURL(url);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="uva-secondary"
        size="uva"
        className="min-h-12 w-auto px-[22px] text-base"
        onClick={handleClick}
        disabled={pending}
      >
        <Download className="size-[18px]" strokeWidth={1.8} aria-hidden />
        {pending ? "Preparando…" : "Descargar mis datos"}
      </Button>
      {error && (
        <p role="alert" className="text-uva-detalle text-uva-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}
