"use client";

import { useState } from "react";
import { Download, Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { descargarCertificadoPdf } from "@/actions/certificados/descargar";

/**
 * "Descargar PDF" y "Copiar enlace" de un certificado. El enlace es la
 * página pública de verificación (la misma del QR del PDF): quien lo abre
 * comprueba que el certificado es real y de esa persona.
 */
export function AccionesCertificado({
  certificadoId,
  urlVerificacion,
}: {
  certificadoId: string;
  urlVerificacion: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);

  async function descargar() {
    setCargando(true);
    setAviso(null);
    const resultado = await descargarCertificadoPdf(certificadoId);
    setCargando(false);
    if (resultado.error || !resultado.url) {
      setAviso({ texto: resultado.error ?? "No pudimos generar tu certificado.", error: true });
      return;
    }
    window.location.href = resultado.url;
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(urlVerificacion);
      setAviso({ texto: "Enlace copiado.", error: false });
    } catch {
      // Sin permiso de portapapeles: se muestra el enlace para copiarlo a mano.
      setAviso({ texto: `Copia este enlace: ${urlVerificacion}`, error: false });
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2 lg:flex-col lg:flex-nowrap">
        <Button
          type="button"
          variant="uva-primary"
          size="uva"
          className="min-h-11 flex-1 gap-2 px-4 text-uva-cuerpo"
          onClick={descargar}
          disabled={cargando}
        >
          {cargando ? (
            <Loader2 className="size-[18px] animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-[18px]" aria-hidden="true" />
          )}
          {cargando ? "Generando…" : "Descargar PDF"}
        </Button>
        <Button
          type="button"
          variant="uva-secondary"
          size="uva"
          className="min-h-11 flex-1 gap-2 px-4 text-uva-cuerpo"
          onClick={copiar}
        >
          <Link2 className="size-[18px]" aria-hidden="true" />
          Copiar enlace
        </Button>
      </div>
      <p aria-live="polite" className={`text-uva-detalle break-all ${aviso?.error ? "text-uva-danger-text" : "text-uva-text-muted"}`}>
        {aviso?.texto}
      </p>
    </div>
  );
}
