"use client";

import { useState, useSyncExternalStore } from "react";
import { Download, Link2, Loader2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { descargarCertificadoPdf } from "@/actions/certificados/descargar";

/** Nada que escuchar: el tipo de puntero no cambia mientras la página está abierta. */
const sinSuscripcion = () => () => {};

/** Celular o tableta con el menú de compartir del sistema. En escritorio
 *  (puntero fino) se copia: el menú de compartir de Windows o macOS ofrece
 *  apps, no el portapapeles, que es lo que se busca ahí. */
function puedeCompartir() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    window.matchMedia("(pointer: coarse)").matches
  );
}

/**
 * "Descargar PDF" y "Compartir enlace" (celular) o "Copiar enlace"
 * (escritorio) de un certificado. El enlace es la página pública de
 * verificación (la misma del QR del PDF): quien lo abre comprueba que el
 * certificado es real y de esa persona.
 */
export function AccionesCertificado({
  certificadoId,
  urlVerificacion,
  cursoTitulo,
}: {
  certificadoId: string;
  urlVerificacion: string;
  cursoTitulo: string;
}) {
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);
  // El servidor no sabe qué dispositivo es: arranca en "Copiar enlace" y
  // cambia al hidratar si el navegador puede compartir.
  const compartir = useSyncExternalStore(sinSuscripcion, puedeCompartir, () => false);

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

  async function compartirEnlace() {
    setAviso(null);
    try {
      await navigator.share({
        title: `Certificado: ${cursoTitulo}`,
        text: `Mi certificado de ${cursoTitulo} en U.V.A.`,
        url: urlVerificacion,
      });
    } catch (error) {
      // Cerrar el menú sin elegir nada no es un fallo.
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copiar();
    }
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
          onClick={compartir ? compartirEnlace : copiar}
        >
          {compartir ? (
            <Share2 className="size-[18px]" aria-hidden="true" />
          ) : (
            <Link2 className="size-[18px]" aria-hidden="true" />
          )}
          {compartir ? "Compartir enlace" : "Copiar enlace"}
        </Button>
      </div>
      <p aria-live="polite" className={`text-uva-detalle break-all ${aviso?.error ? "text-uva-danger-text" : "text-uva-text-muted"}`}>
        {aviso?.texto}
      </p>
    </div>
  );
}
