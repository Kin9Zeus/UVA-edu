import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccesoMarco } from "@/components/auth/AccesoMarco";
import { AvisoAcceso } from "@/components/auth/AvisoAcceso";
import { NivelObra, POSICION_NIVEL } from "@/components/auth/NivelObra";
import { ReenviarVerificacion } from "@/components/auth/ReenviarVerificacion";
import {
  ACCESO_NOTA,
  ACCESO_SUBTITULO,
  ACCESO_TITULO,
} from "@/components/auth/acceso";
import { IrAlLoginAlConfirmar } from "@/components/sesion/IrAlLoginAlConfirmar";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "U.V.A. — Verifica tu correo",
};

export default async function VerificarCorreoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.email_confirmed_at) {
    redirect("/dashboard");
  }

  // Mismo marco y mismo aviso que «¡Ya casi!» del registro (AuthFlow): quien
  // llega aquí acaba de pasar por esa pantalla o volvió a entrar sin confirmar.
  return (
    <AccesoMarco>
      <div className="grid grid-cols-1 gap-5 medio:gap-4 bajo:gap-3 muy-bajo:gap-2.5">
        <div className="muy-bajo:[zoom:0.85]">
          <NivelObra posicion={POSICION_NIVEL.centro} />
        </div>

        <div className="grid grid-cols-1 gap-2 bajo:gap-1">
          <h1 className={ACCESO_TITULO}>Verifica tu correo</h1>
          <p className={`${ACCESO_SUBTITULO} muy-bajo:sr-only`}>
            Tu cuenta está creada, pero falta confirmar tu correo para entrar.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 bajo:gap-2">
          <AvisoAcceso icono="correo">
            Enviamos un enlace de confirmación a{" "}
            <strong className="[overflow-wrap:anywhere]">{user.email}</strong>.
            Ábrelo para activar tu cuenta.
          </AvisoAcceso>
          <p className={ACCESO_NOTA}>
            ¿No te llegó? Revisa la carpeta de spam o de promociones.
          </p>
          <ReenviarVerificacion email={user.email ?? ""} />
          <IrAlLoginAlConfirmar correo={user.email ?? ""} />
        </div>
      </div>
    </AccesoMarco>
  );
}
