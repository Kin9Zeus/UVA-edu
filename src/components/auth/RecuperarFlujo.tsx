"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AvisoAcceso } from "@/components/auth/AvisoAcceso";
import { MensajeError } from "@/components/auth/MensajeError";
import { PasoAcceso } from "@/components/auth/PasoAcceso";
import { POSICION_NIVEL } from "@/components/auth/NivelObra";
import {
  ACCESO_BOTON,
  ACCESO_ENLACE,
  ACCESO_INPUT,
  ACCESO_LABEL,
} from "@/components/auth/acceso";
import { recuperar, type RecuperarState } from "@/actions/auth/recuperar";

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Recupera tu contraseña (Recuperar lab 7, "Nivel"): pide el correo (viene
 * escrito si se llegó desde el login) y envía el enlace. La burbuja del nivel
 * avanza cuando el correo es válido y queda a nivel al enviarlo; la ruta pasa
 * del paso 1 al 2.
 */
export function RecuperarFlujo({ emailInicial }: { emailInicial: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [state, formAction, pending] = useActionState<RecuperarState, FormData>(
    recuperar,
    null,
  );
  const enviado = Boolean(state?.success);
  const valido = CORREO_VALIDO.test(email.trim());

  // Tras cada envío el foco va a donde está la respuesta: al campo si hubo
  // error (el lector lee el campo, su aria-describedby y el alert), o al
  // aviso de éxito, que reemplaza al formulario y si no se perdería.
  const campoRef = useRef<HTMLInputElement>(null);
  const exitoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state?.error) campoRef.current?.focus();
    else if (state?.success) exitoRef.current?.focus();
  }, [state]);

  return (
    <PasoAcceso
      posicionNivel={
        enviado ? POSICION_NIVEL.centro : valido ? POSICION_NIVEL.avance : POSICION_NIVEL.inicio
      }
      titulo="Recupera tu contraseña"
      subtitulo="Escribe el correo con el que te registraste y te enviamos un enlace para crear una nueva."
      paso={enviado ? 1 : 0}
    >
      {enviado ? (
        <div ref={exitoRef} tabIndex={-1} className="focus:outline-none">
          <AvisoAcceso icono="ok">
            Si el correo existe en nuestra base de datos, te llegará un enlace en unos minutos.
          </AvisoAcceso>
        </div>
      ) : (
        <form action={formAction} className="grid grid-cols-1 gap-3 bajo:gap-2" noValidate>
          <div>
            <Label htmlFor="recuperar-email" className={ACCESO_LABEL}>
              Correo electrónico
            </Label>
            <Input
              id="recuperar-email"
              name="email"
              type="email"
              placeholder="Ingresa tu correo electrónico"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={ACCESO_INPUT}
              ref={campoRef}
              aria-invalid={state?.error ? true : undefined}
              aria-describedby={state?.error ? "recuperar-email-error" : undefined}
            />
          </div>
          {state?.error && <MensajeError id="recuperar-email-error">{state.error}</MensajeError>}
          <Button
            type="submit"
            variant="uva-primary"
            size="uva"
            disabled={pending}
            className={ACCESO_BOTON}
          >
            {pending ? "Enviando…" : "Enviar enlace"}
          </Button>
        </form>
      )}

      <p>
        <Link href="/login" className={ACCESO_ENLACE}>
          Volver a iniciar sesión
        </Link>
      </p>
    </PasoAcceso>
  );
}
