import type { Metadata } from "next";
import Link from "next/link";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { NivelObra, POSICION_NIVEL } from "@/components/auth/NivelObra";
import { ACCESO_BOTON, ACCESO_SUBTITULO, ACCESO_TITULO } from "@/components/auth/acceso";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "U.V.A. — Cuenta eliminada",
  robots: { index: false, follow: false },
};

/**
 * Destino tras eliminarMiCuenta() (src/actions/perfil/eliminar-cuenta.ts,
 * P2-11 de AUDIT-2026-09-15.md). No requiere sesión — a propósito: la
 * acción ya cerró la sesión y baneó la cuenta, así que esta pantalla tiene
 * que poder mostrarse sin ella. Redirigir al dashboard en su lugar mostraría
 * un error de acceso denegado en vez de confirmar que la solicitud se
 * atendió, que es justo lo que el titular necesita ver.
 *
 * Mismo marco que el resto del acceso. El texto legal va en tres párrafos
 * cortos: qué se borró, qué se conserva y qué pasa con los certificados.
 */
export default function CuentaEliminadaPage() {
  return (
    <AccesoMarco>
      <div className="grid grid-cols-1 gap-5 medio:gap-4 bajo:gap-3">
        <NivelObra posicion={POSICION_NIVEL.final} />

        <div className="grid grid-cols-1 gap-3 bajo:gap-2">
          <h1 className={ACCESO_TITULO}>Cuenta eliminada</h1>
          <p className={ACCESO_SUBTITULO}>
            Suprimimos tus datos personales (nombre, correo, celular, foto y el
            contenido que escribiste) y cerramos tu sesión en todas partes. No
            podrás volver a iniciar sesión con esta cuenta.
          </p>
          <p className={ACCESO_SUBTITULO}>
            El registro de pagos se conserva por obligación legal y contable, ya
            sin tu nombre asociado.
          </p>
          <p className={ACCESO_SUBTITULO}>
            Los certificados que hayas obtenido siguen siendo válidos y conservan
            el nombre con el que se emitieron, para que cualquiera pueda
            verificarlos con su código.
          </p>
        </div>

        <Link
          href="/"
          className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), ACCESO_BOTON)}
        >
          Volver al inicio
        </Link>
      </div>
    </AccesoMarco>
  );
}
