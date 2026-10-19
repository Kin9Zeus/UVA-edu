"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button, buttonVariants } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { ReglasPassword } from "@/components/auth/ReglasPassword";
import { AvisoAcceso } from "@/components/auth/AvisoAcceso";
import { MensajeError } from "@/components/auth/MensajeError";
import { PasoAcceso } from "@/components/auth/PasoAcceso";
import { POSICION_NIVEL } from "@/components/auth/NivelObra";
import {
  ACCESO_BOTON,
  ACCESO_INPUT,
  ACCESO_LABEL,
} from "@/components/auth/acceso";
import { passwordRules } from "@/lib/password";
import { cn } from "@/lib/utils";
import { avisarPestanas } from "@/lib/sesion/pestanas";
import {
  actualizarPassword,
  type ActualizarPasswordState,
} from "@/actions/auth/actualizar-password";

/**
 * Crea tu nueva contraseña (Nueva contraseña lab 7, "Nivel"). La burbuja
 * sigue el recorrido de izquierda a derecha: llega al centro con el enlace
 * enviado, se queda ahí mientras se crea la contraseña y pasa a la derecha
 * cuando queda guardada. Al
 * guardar, actualizarPassword cierra la sesión del enlace y esta pantalla
 * pasa a "Contraseña guardada" con "Iniciar sesión", que precarga el correo.
 */
export function NuevaContrasenaFlujo() {
  const [state, formAction, pending] = useActionState<ActualizarPasswordState, FormData>(
    actualizarPassword,
    null,
  );
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const guardada = Boolean(state?.guardada);
  const cumplidas = passwordRules.filter((regla) => regla.test(password)).length;
  const coinciden = password.length > 0 && password === password2;
  const noCoinciden = password2.length > 0 && !coinciden;
  const lista = cumplidas === passwordRules.length && coinciden;

  // El formulario se reemplaza entero al guardar: el foco va al título
  // nuevo para que el lector de pantalla anuncie "Contraseña guardada".
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (guardada) tituloRef.current?.focus();
  }, [guardada]);

  // La pestaña donde se pidió el enlace sigue en "te llegará un enlace":
  // se le avisa para que pase sola a "Contraseña guardada".
  const correoGuardado = state?.guardada ? state.email : null;
  useEffect(() => {
    if (correoGuardado) avisarPestanas({ tipo: "contrasena-guardada", correo: correoGuardado });
  }, [correoGuardado]);

  const login = state?.guardada && state.email
    ? `/login?email=${encodeURIComponent(state.email)}`
    : "/login";

  return (
    <PasoAcceso
      posicionNivel={guardada ? POSICION_NIVEL.final : POSICION_NIVEL.centro}
      titulo={guardada ? "Contraseña guardada" : "Crea tu nueva contraseña"}
      subtitulo={
        guardada
          ? "Ya puedes entrar a U.V.A. con tu nueva contraseña."
          : "Esta será tu nueva contraseña para iniciar sesión en U.V.A."
      }
      paso={guardada ? 3 : 2}
      tituloRef={tituloRef}
    >
      {guardada ? (
        <>
          <AvisoAcceso icono="ok">
            Guardamos tu nueva contraseña. Ya puedes iniciar sesión con ella.
          </AvisoAcceso>
          {/* Un enlace, no un botón: es navegación. */}
          <Link
            href={login}
            className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), ACCESO_BOTON)}
          >
            Iniciar sesión
          </Link>
        </>
      ) : (
        <form action={formAction} className="grid grid-cols-1 gap-2.5 bajo:gap-2" noValidate>
          <div>
            <Label htmlFor="nueva-pass" className={ACCESO_LABEL}>
              Nueva contraseña
            </Label>
            <PasswordInput
              inputClassName={ACCESO_INPUT}
              id="nueva-pass"
              name="password"
              placeholder="Mínimo 10 caracteres"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              alternar="texto"
              describedBy="nueva-reglas"
            />
          </div>
          <ReglasPassword id="nueva-reglas" password={password} className="-mt-1" />

          <div>
            <Label htmlFor="nueva-pass2" className={ACCESO_LABEL}>
              Repite la contraseña
            </Label>
            <PasswordInput
              inputClassName={ACCESO_INPUT}
              id="nueva-pass2"
              name="password2"
              placeholder="Debe coincidir"
              autoComplete="new-password"
              value={password2}
              onChange={(event) => setPassword2(event.target.value)}
              required
              alternar="texto"
              invalid={noCoinciden}
              describedBy={noCoinciden ? "nueva-pass2-error" : undefined}
            />
          </div>
          {noCoinciden && (
            <MensajeError id="nueva-pass2-error">Las contraseñas no coinciden.</MensajeError>
          )}
          {state?.error && <MensajeError id="nueva-error">{state.error}</MensajeError>}

          <Button
            type="submit"
            variant="uva-primary"
            size="uva"
            disabled={!lista || pending}
            className={`${ACCESO_BOTON} disabled:border-uva-divider disabled:bg-uva-chip disabled:text-uva-text-muted disabled:opacity-100`}
          >
            {pending ? "Guardando…" : "Guardar nueva contraseña"}
          </Button>
        </form>
      )}
    </PasoAcceso>
  );
}
