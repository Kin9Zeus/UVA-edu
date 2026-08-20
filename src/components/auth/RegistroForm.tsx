"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { CheckIcon, DotIcon } from "@/components/auth/icons";
import { passwordRules, isPasswordValid } from "@/lib/password";
import { registro, type RegistroState } from "@/actions/auth/registro";

export function RegistroForm({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [registroState, formAction, pending] = useActionState<
    RegistroState,
    FormData
  >(registro, null);

  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === password2;
  const canSubmit = passwordValid && passwordsMatch && aceptaTerminos;

  if (registroState?.needsConfirmation) {
    return (
      <div
        role="status"
        className="mt-4 rounded-uva-md bg-uva-success-soft px-4 py-3.5 text-center text-[13px] leading-[1.5] text-uva-success-text"
      >
        Creamos tu cuenta. Revisa tu correo y confirma tu cuenta para poder
        iniciar sesión.
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-2" action={formAction}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="redirect" value={redirectTo} />

      {registroState?.error && (
        <div
          role="alert"
          className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-center text-[13px] text-uva-danger-text"
        >
          {registroState.error}
        </div>
      )}

      <div>
        <Label htmlFor="reg-pass">Contraseña</Label>
        <PasswordInput
          id="reg-pass"
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
        <Label htmlFor="reg-pass2">Repite la contraseña</Label>
        <PasswordInput
          id="reg-pass2"
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

      <label className="mt-1.5 flex items-start gap-2 text-[12px] leading-[1.4] text-uva-text-muted">
        <input
          type="checkbox"
          checked={aceptaTerminos}
          onChange={(event) => setAceptaTerminos(event.target.checked)}
          className="mt-0.5 size-3.5 shrink-0 accent-uva-accent"
        />
        Acepto los{" "}
        <Link href="/terminos" className="underline" target="_blank">
          Términos
        </Link>{" "}
        y la{" "}
        <Link href="/privacidad" className="underline" target="_blank">
          Política de privacidad
        </Link>
      </label>

      <Button
        type="submit"
        variant="uva-primary"
        size="uva"
        disabled={!canSubmit || pending}
        className="mt-1.5 min-h-10 text-[15px]"
      >
        {pending ? "Creando cuenta…" : "Crear mi cuenta"}
      </Button>
    </form>
  );
}
