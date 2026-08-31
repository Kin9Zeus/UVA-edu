"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { descargarCertificadoPdf } from "@/actions/certificados/descargar";

export function DescargarCertificadoButton({ certificadoId }: { certificadoId: string }) {
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function descargar() {
    setCargando(true);
    setError(null);
    const resultado = await descargarCertificadoPdf(certificadoId);
    setCargando(false);

    if (resultado.error || !resultado.url) {
      setError(resultado.error ?? "No pudimos generar tu certificado.");
      return;
    }
    window.location.href = resultado.url;
  }

  return (
    <div className="ml-auto flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-auto gap-1.5 text-uva-accent-text hover:text-uva-accent"
        onClick={descargar}
        disabled={cargando}
      >
        {cargando ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
        {cargando ? "Generando…" : "Descargar PDF"}
      </Button>
      {error && <p className="text-[11px] text-uva-danger-text">{error}</p>}
    </div>
  );
}
