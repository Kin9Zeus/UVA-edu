"use client";

import { useActionState, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { CheckIcon, DotIcon } from "@/components/auth/icons";
import { passwordRules, isPasswordValid } from "@/lib/password";
import {
  cambiarPassword,
  type CambiarPasswordState,
} from "@/actions/perfil/cambiar-password";

/**
 * Card de "Mi perfil" para cambiar la contraseña sin salir de la sesión —
 * distinta del formulario de datos de arriba (otra Server Action, otro
 * <form>) porque cambiarPassword() reautentica con la contraseña actual
 * antes de aplicar la nueva (ver el comentario en esa action).
 */
export function CambiarPasswordForm() {
  const [state, formAction, pending] = useActionState<
    CambiarPasswordState,
    FormData
  >(cambiarPassword, null);
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordNueva2, setPasswordNueva2] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const passwordsMatch = passwordNueva.length > 0 && passwordNueva === passwordNueva2;
  const canSubmit = isPasswordValid(passwordNueva) && passwordsMatch;

  async function handleAction(formData: FormData) {
    await formAction(formData);
    // Los 3 campos son sensibles y no deben quedar en el DOM tras un envío
    // exitoso ni tras un error (p. ej. "contraseña actual incorrecta": el
    // usuario debe volver a escribirla, no reintentar con la misma).
    formRef.current?.reset();
    setPasswordNueva("");
    setPasswordNueva2("");
  }

  return (
    <div className="flex flex-col gap-[18px] rounded-uva-md border border-uva-divider bg-uva-surface p-6">
      <h2 className="flex items-center gap-2 text-base text-uva-text">
        <KeyRound className="size-4 text-uva-accent" aria-hidden />
        Contraseña
      </h2>

      <form ref={formRef} action={handleAction} className="flex flex-col gap-3.5" noValidate>
        {state?.error && (
          <div
            role="alert"
            className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-sm text-uva-danger-text"
          >
            {state.error}
          </div>
        )}

        <div>
          <Label htmlFor="perfil-password-actual">Contraseña actual</Label>
          <PasswordInput
            id="perfil-password-actual"
            name="password_actual"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <div>
            <Label htmlFor="perfil-password-nueva">Nueva contraseña</Label>
            <PasswordInput
              id="perfil-password-nueva"
              name="password_nueva"
              placeholder="Mínimo 10 caracteres"
              autoComplete="new-password"
              value={passwordNueva}
              onChange={(event) => setPasswordNueva(event.target.value)}
              required
            />
          </div>
          <div>
            <Label htmlFor="perfil-password-nueva2">Repite la contraseña</Label>
            <PasswordInput
              id="perfil-password-nueva2"
              name="password_nueva2"
              placeholder="Debe coincidir"
              autoComplete="new-password"
              value={passwordNueva2}
              onChange={(event) => setPasswordNueva2(event.target.value)}
              required
            />
            {passwordNueva2.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-xs text-uva-danger-text">Las contraseñas no coinciden</p>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-2 gap-x-2.5 gap-y-1">
          {passwordRules.map((rule) => {
            const met = rule.test(passwordNueva);
            const colorClass = met
              ? "text-uva-valid"
              : passwordNueva.length > 0
                ? "text-uva-danger-text"
                : "text-uva-text-faint";
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-1.5 text-[11px] leading-[1.3] transition-colors duration-150 [transition-timing-function:ease] [&_svg]:size-3 [&_svg]:shrink-0 ${colorClass}`}
              >
                {met ? <CheckIcon /> : <DotIcon />}
                {rule.label}
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="uva-primary"
            size="uva"
            disabled={!canSubmit || pending}
            className="w-auto px-6"
          >
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </Button>
          {state?.success && (
            <span
              role="status"
              className="rounded-full bg-uva-accent-2-soft px-2.5 py-1 text-[11px] text-uva-accent-2-text"
            >
              Contraseña actualizada
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
