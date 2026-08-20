"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { login, type LoginState } from "@/actions/auth/login";

export function LoginForm({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );

  return (
    <form className="flex flex-col gap-3.5" action={formAction} noValidate>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="redirect" value={redirectTo} />

      {state?.error && (
        <div
          role="alert"
          className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-center text-[13px] text-uva-danger-text"
        >
          {state.error}
        </div>
      )}

      <div>
        <Label htmlFor="login-pass">Contraseña</Label>
        <PasswordInput
          id="login-pass"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </div>

      <div className="mt-2.5 flex justify-end">
        <Link href="/recuperar" className="text-xs">
          ¿Olvidaste tu contraseña?
        </Link>
      </div>

      <Button
        type="submit"
        variant="uva-primary"
        size="uva"
        disabled={pending}
        className="mt-4 min-h-[46px] text-[15px]"
      >
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
