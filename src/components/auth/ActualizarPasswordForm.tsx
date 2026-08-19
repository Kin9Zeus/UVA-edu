"use client";

import { useActionState, useState } from "react";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckIcon, DotIcon } from "@/components/auth/icons";
import { passwordRules, isPasswordValid } from "@/lib/password";
import {
  actualizarPassword,
  type ActualizarPasswordState,
} from "@/actions/auth/actualizar-password";

export function ActualizarPasswordForm() {
  const [state, formAction, pending] = useActionState<
    ActualizarPasswordState,
    FormData
  >(actualizarPassword, null);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const passwordsMatch = password.length > 0 && password === password2;
  const canSubmit = isPasswordValid(password) && passwordsMatch;

  return (
    <form action={formAction} className="flex flex-col gap-3.5" noValidate>
      {state?.error && (
        <div
          role="alert"
          className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-center text-[13px] text-uva-danger-text"
        >
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="nueva-pass">Nueva contraseña</Label>
        <PasswordInput
          id="nueva-pass"
          name="password"
          placeholder="Mínimo 10 caracteres"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />

        <ul className="mt-1.5 grid grid-cols-2 gap-x-2.5 gap-y-1">
          {passwordRules.map((rule) => {
            const met = rule.test(password);
            const colorClass = met
              ? "text-uva-valid"
              : password.length > 0
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
      </div>

      <div>
        <Label htmlFor="nueva-pass2">Repite la contraseña</Label>
        <PasswordInput
          id="nueva-pass2"
          name="password2"
          placeholder="Debe coincidir"
          autoComplete="new-password"
          value={password2}
          onChange={(event) => setPassword2(event.target.value)}
          required
        />
        {password2.length > 0 && !passwordsMatch && (
          <p className="mt-1.5 text-xs text-uva-danger-text">
            Las contraseñas no coinciden
          </p>
        )}
      </div>

      <Button
        type="submit"
        variant="uva-primary"
        size="uva"
        disabled={!canSubmit || pending}
        className="mt-4 min-h-[46px] text-[15px]"
      >
        {pending ? "Guardando…" : "Guardar nueva contraseña"}
      </Button>
    </form>
  );
}
