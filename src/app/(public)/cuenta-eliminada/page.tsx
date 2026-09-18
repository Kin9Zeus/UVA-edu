import type { Metadata } from "next";
import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { buttonVariants } from "@/components/ui/button";

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
 */
export default function CuentaEliminadaPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 min-[900px]:grid-cols-2">
      <AuthVisual />

      <section className="grid place-items-center bg-[rgba(250,250,250,0.04)] p-7 min-[900px]:p-11">
        <div className="w-full max-w-[396px] text-center">
          <h2 className="mb-1.5 text-[30px] text-uva-text">Cuenta eliminada</h2>
          <p className="mb-6 text-sm text-uva-text-muted">
            Suprimimos tus datos personales (nombre, correo, celular, foto y
            el contenido que escribiste) y cerramos tu sesión en todas
            partes. El registro de pagos se conserva por obligación legal/
            contable, ya sin tu nombre asociado. Los certificados que hayas
            obtenido siguen siendo válidos y conservan el nombre con el que
            se emitieron, para que cualquiera pueda seguir verificándolos
            con su código. No podrás volver a iniciar sesión con esta
            cuenta.
          </p>

          <Link href="/" className={buttonVariants({ variant: "uva-primary", size: "uva" })}>
            Volver al inicio
          </Link>
        </div>
      </section>
    </div>
  );
}
