"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { AvisoAcceso } from "@/components/auth/AvisoAcceso";
import { MensajeError } from "@/components/auth/MensajeError";
import { PasoAcceso } from "@/components/auth/PasoAcceso";
import { POSICION_NIVEL } from "@/components/auth/NivelObra";
import {
  ACCESO_BOTON,
  ACCESO_ENLACE,
  ACCESO_INPUT,
  ACCESO_LABEL,
  ACCESO_NOTA,
} from "@/components/auth/acceso";
import { recuperar, type RecuperarState } from "@/actions/auth/recuperar";
import { escucharPestanas, mismoCorreo } from "@/lib/sesion/pestanas";
import { cn } from "@/lib/utils";

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Recupera tu contraseña (Recuperar lab 7, "Nivel"): pide el correo (viene
 * escrito si se llegó desde el login) y envía el enlace. La burbuja del nivel
 * avanza cuando el correo es válido y queda a nivel al enviarlo; la ruta pasa
 * del paso 1 al 2.
 *
 * El enlace del correo abre otra pestaña. Si ahí se guarda la contraseña
 * nueva (mismo navegador y mismo correo), esta pantalla pasa sola a
 * "Contraseña guardada" en vez de quedarse en "te llegará un enlace".
 */
export function RecuperarFlujo({ emailInicial }: { emailInicial: string }) {
  const [email, setEmail] = useState(emailInicial);
  const [state, formAction, pending] = useActionState<RecuperarState, FormData>(
    recuperar,
    null,
  );
  const enviado = Boolean(state?.success);
  const valido = CORREO_VALIDO.test(email.trim());
  const [guardadaEnOtraPestana, setGuardadaEnOtraPestana] = useState(false);

  useEffect(() => {
    if (!enviado) return;
    return escucharPestanas((aviso) => {
      if (aviso.tipo === "contrasena-guardada" && mismoCorreo(aviso.correo, email)) {
        setGuardadaEnOtraPestana(true);
      }
    });
  }, [enviado, email]);

  // Tras cada envío el foco va a donde está la respuesta: al campo si hubo
  // error (el lector lee el campo, su aria-describedby y el alert), o al
  // aviso de éxito, que reemplaza al formulario y si no se perdería.
  const campoRef = useRef<HTMLInputElement>(null);
  const exitoRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state?.error) campoRef.current?.focus();
    else if (state?.success) exitoRef.current?.focus();
  }, [state]);

  // El contenido se reemplaza: el foco va al aviso nuevo para que el lector
  // de pantalla lo anuncie.
  const guardadaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (guardadaEnOtraPestana) guardadaRef.current?.focus();
  }, [guardadaEnOtraPestana]);

  if (guardadaEnOtraPestana) {
    return (
      <PasoAcceso
        posicionNivel={POSICION_NIVEL.final}
        titulo="Contraseña guardada"
        subtitulo="Ya puedes entrar a U.V.A. con tu nueva contraseña."
        paso={3}
      >
        <div ref={guardadaRef} tabIndex={-1} className="focus:outline-none">
          <AvisoAcceso icono="ok">
            Guardaste tu nueva contraseña en la otra pestaña. Ya puedes iniciar sesión con ella.
          </AvisoAcceso>
        </div>
        {/* Un enlace, no un botón: es navegación. */}
        <Link
          href={`/login?email=${encodeURIComponent(email.trim())}`}
          className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), ACCESO_BOTON)}
        >
          Iniciar sesión
        </Link>
      </PasoAcceso>
    );
  }

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
          <p className={`mt-3 ${ACCESO_NOTA}`}>
            Si abres el enlace en este mismo navegador, esta pantalla se actualiza sola cuando
            guardes la contraseña nueva.
          </p>
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
