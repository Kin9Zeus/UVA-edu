"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { MensajeError } from "@/components/auth/MensajeError";
import {
  ACCESO_BOTON,
  ACCESO_ENLACE,
  ACCESO_INPUT,
  ACCESO_LABEL,
} from "@/components/auth/acceso";
import { login, type LoginState } from "@/actions/auth/login";

export function LoginForm({
  email,
  redirectTo,
  onPendienteVerificacion,
}: {
  email: string;
  redirectTo: string;
  onPendienteVerificacion?: () => void;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );

  useEffect(() => {
    if (state?.pendingVerification) {
      onPendienteVerificacion?.();
    }
  }, [state, onPendienteVerificacion]);

  if (state?.pendingVerification) {
    return null;
  }

  return (
    <form className="grid grid-cols-1 gap-3 bajo:gap-2" action={formAction} noValidate>
      {/* El correo se escribió en el paso anterior. Un `type="hidden"` lo
          ignoran los gestores de contraseñas: este campo oculto con
          `autocomplete="username"` les dice de qué cuenta es la clave. */}
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      <input type="hidden" name="redirect" value={redirectTo} />

      <div>
        <Label htmlFor="login-pass" className={ACCESO_LABEL}>
          Contraseña
        </Label>
        <PasswordInput
          inputClassName={ACCESO_INPUT}
          id="login-pass"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          alternar="texto"
          describedBy={state?.error ? "login-error" : undefined}
        />
      </div>

      {state?.error && <MensajeError id="login-error">{state.error}</MensajeError>}

      {/* Lleva el correo ya escrito: /recuperar lo muestra en el campo. */}
      <Link
        href={`/recuperar?email=${encodeURIComponent(email)}`}
        className={`justify-self-end ${ACCESO_ENLACE}`}
      >
        ¿Olvidaste tu contraseña?
      </Link>

      <Button
        type="submit"
        variant="uva-primary"
        size="uva"
        cargando={pending}
        className={ACCESO_BOTON}
      >
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
