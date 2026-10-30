"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { PasoAcceso } from "@/components/auth/PasoAcceso";
import { POSICION_NIVEL } from "@/components/auth/NivelObra";
import { CampoCodigoSegundoFactor } from "@/components/auth/CampoCodigoSegundoFactor";
import { ACCESO_BOTON, ACCESO_NOTA } from "@/components/auth/acceso";
import { logout } from "@/actions/auth/logout";
import { verificarSegundoFactor, type VerificarCodigoState } from "@/actions/seguridad/segundo-factor";

const PASOS = ["Tu contraseña", "Tu código", "Entras al panel"];

/**
 * Pantalla de quien YA tiene su app de autenticación registrada y entra al
 * panel: escribe el código y Supabase sube la sesión a aal2. FASE 8.1.
 */
export function VerificarSegundoFactorFlujo({ destino }: { destino: string }) {
  const [state, formAction, pending] = useActionState<VerificarCodigoState, FormData>(
    verificarSegundoFactor,
    null,
  );

  return (
    <PasoAcceso
      posicionNivel={POSICION_NIVEL.centro}
      titulo="Escribe tu código"
      subtitulo="Abre tu app de autenticación y escribe el código de 6 dígitos de U.V.A. Cambia cada 30 segundos."
      paso={1}
      pasos={PASOS}
      etiquetaPasos="Pasos para entrar al panel"
    >
      <form action={formAction} className="grid grid-cols-1 gap-2.5 bajo:gap-2" noValidate>
        <input type="hidden" name="redirect" value={destino} />
        <CampoCodigoSegundoFactor id="verificar-codigo" error={state?.error} />
        <Button
          type="submit"
          variant="uva-primary"
          size="uva"
          disabled={pending}
          className={ACCESO_BOTON}
        >
          {pending ? "Verificando…" : "Verificar y entrar"}
        </Button>
      </form>

      {/* Formulario y no onClick: funciona aunque el JavaScript no haya cargado. */}
      <form action={logout} className="grid justify-items-start gap-1">
        <p className={ACCESO_NOTA}>¿No tienes tu celular a la mano?</p>
        <Button type="submit" variant="uva-secondary" size="uva" className="min-h-11 w-auto px-[22px] text-base">
          Cerrar sesión
        </Button>
      </form>
    </PasoAcceso>
  );
}
