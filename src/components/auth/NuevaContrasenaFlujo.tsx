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
import {
  ACCESO_BOTON,
  ACCESO_INPUT,
  ACCESO_LABEL,
} from "@/components/auth/acceso";
import { passwordRules } from "@/lib/password";
import {
  actualizarPassword,
  type ActualizarPasswordState,
} from "@/actions/auth/actualizar-password";

/** Burbuja y cota del nivel según cuántos requisitos van cumplidos (0 a 5). */
const POSICIONES = [16, 23, 30, 37, 44, 50];
const COTAS = ["N +0,15", "N +0,12", "N +0,09", "N +0,06", "N +0,03", "N ±0,00"];

/**
 * Crea tu nueva contraseña (Nueva contraseña lab 7, "Nivel"): cada regla
 * cumplida y la repetición que coincide acercan la burbuja al centro. Al
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
  const hechos = guardada ? 5 : cumplidas + (coinciden ? 1 : 0);
  const lista = hechos === 5;

  // El formulario se reemplaza entero al guardar: el foco va al título
  // nuevo para que el lector de pantalla anuncie "Contraseña guardada".
  const tituloRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (guardada) tituloRef.current?.focus();
  }, [guardada]);

  const login = state?.guardada && state.email
    ? `/login?email=${encodeURIComponent(state.email)}`
    : "/login";

  return (
    <PasoAcceso
      nivel={{ aNivel: lista, posicion: POSICIONES[hechos], cota: COTAS[hechos] }}
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
            className={buttonVariants({ variant: "uva-primary", size: "uva", className: ACCESO_BOTON })}
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
