"use client";

import { useActionState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { PasoAcceso } from "@/components/auth/PasoAcceso";
import { POSICION_NIVEL } from "@/components/auth/NivelObra";
import { MensajeError } from "@/components/auth/MensajeError";
import { CampoCodigoSegundoFactor } from "@/components/auth/CampoCodigoSegundoFactor";
import { ACCESO_BOTON, ACCESO_NOTA } from "@/components/auth/acceso";
import {
  confirmarActivacion,
  iniciarActivacion,
  type IniciarActivacionState,
  type VerificarCodigoState,
} from "@/actions/seguridad/segundo-factor";

const PASOS = ["Tu contraseña", "Registras tu app", "Confirmas el código"];

/**
 * Activar la verificación en dos pasos — FASE 8.1 del plan de blindaje. Dos
 * momentos en la misma tarjeta:
 *
 *   1. Explicación y «Empezar»: aquí se crea el factor. No se crea al cargar la
 *      página a propósito: una visita (o una precarga del navegador) no debe
 *      dejar factores a medio registrar en la cuenta.
 *   2. QR, clave escrita y el primer código: al acertarlo, el factor queda
 *      confirmado y la persona entra al panel.
 */
export function ActivarSegundoFactorFlujo({ destino }: { destino: string }) {
  const [inicio, iniciar, iniciando] = useActionState<IniciarActivacionState, FormData>(
    iniciarActivacion,
    null,
  );
  const [confirmacion, confirmar, confirmando] = useActionState<VerificarCodigoState, FormData>(
    confirmarActivacion,
    null,
  );

  if (inicio?.factorId) {
    return (
      <PasoAcceso
        posicionNivel={POSICION_NIVEL.centro}
        titulo="Escanea el código con tu app"
        subtitulo="Después escribe el código de 6 dígitos que te muestre. Cambia cada 30 segundos."
        paso={2}
        pasos={PASOS}
        etiquetaPasos="Pasos para activar la verificación en dos pasos"
      >
        <div className="grid justify-items-center gap-3">
          {/* El QR ya trae su fondo blanco y su margen de 4 módulos DENTRO del
              SVG (lib/auth/qr.ts), así que se ve igual en los dos temas y el
              lector encuentra dónde empieza. El lado es un múltiplo entero de los
              módulos, para que ninguno salga a medio píxel; `max-w-full` solo
              lo encoge en celulares estrechos, donde el QR casi nunca se
              escanea (se usa la clave escrita de abajo). */}
          <div className="max-w-full overflow-hidden rounded-uva-md border border-uva-divider">
            <Image
              src={inicio.qr}
              alt="Código QR para añadir U.V.A. a tu app de autenticación"
              width={inicio.ladoQr}
              height={inicio.ladoQr}
              unoptimized
              className="block h-auto max-w-full"
            />
          </div>
          <div className="grid justify-items-center gap-1 text-center">
            <p className={ACCESO_NOTA}>¿No puedes escanearlo? Escribe esta clave en tu app:</p>
            <code className="select-all break-all rounded-uva-sm bg-uva-chip px-2 py-1 font-codigo text-uva-detalle text-uva-text">
              {inicio.secreto}
            </code>
          </div>
        </div>

        <form action={confirmar} className="grid grid-cols-1 gap-2.5 bajo:gap-2" noValidate>
          <input type="hidden" name="factorId" value={inicio.factorId} />
          <input type="hidden" name="redirect" value={destino} />
          <CampoCodigoSegundoFactor id="activar-codigo" error={confirmacion?.error} />
          <Button type="submit" variant="uva-primary" size="uva" disabled={confirmando} className={ACCESO_BOTON}>
            {confirmando ? "Activando…" : "Activar y entrar"}
          </Button>
        </form>
      </PasoAcceso>
    );
  }

  return (
    <PasoAcceso
      posicionNivel={POSICION_NIVEL.avance}
      titulo="Activa la verificación en dos pasos"
      subtitulo="Para entrar al panel de administración necesitas, además de tu contraseña, un código de tu celular."
      paso={1}
      pasos={PASOS}
      etiquetaPasos="Pasos para activar la verificación en dos pasos"
    >
      <ol className="grid list-decimal gap-2 pl-5 text-uva-cuerpo text-uva-text marker:font-semibold">
        <li>
          Ten a la mano una app de autenticación en tu celular, como Google Authenticator, Microsoft
          Authenticator o Authy.
        </li>
        <li>Pulsa «Empezar» para ver un código QR.</li>
        <li>Escanéalo con la app y escribe el código de 6 dígitos que te muestre.</li>
      </ol>

      <form action={iniciar} className="grid grid-cols-1 gap-2.5 bajo:gap-2">
        {inicio?.error && <MensajeError id="activar-error">{inicio.error}</MensajeError>}
        <Button type="submit" variant="uva-primary" size="uva" disabled={iniciando} className={ACCESO_BOTON}>
          {iniciando ? "Preparando…" : "Empezar"}
        </Button>
        <p className={ACCESO_NOTA}>Al activarla, cerramos tus otras sesiones abiertas.</p>
      </form>
    </PasoAcceso>
  );
}
