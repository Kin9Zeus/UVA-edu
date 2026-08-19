"use client";

import { useActionState, useState, type FormEvent } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { CheckIcon, DotIcon } from "@/components/auth/icons";
import { passwordRules, isPasswordValid } from "@/lib/password";
import { registro, type RegistroState } from "@/actions/auth/registro";

/* Este formulario solo se renderiza dentro de /registro, cuya columna de
   formulario se comprime (auth-shell--fit en el CSS original) para caber sin
   scroll en viewports de escritorio típicos (~560px de alto). Por eso usa
   valores más ajustados que Login/Recuperar en vez de las medidas base de
   .btn/.input/.divider, etc. */
export function RegistroForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [registroState, formAction, pending] = useActionState<
    RegistroState,
    FormData
  >(registro, null);

  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === password2;
  const canContinue = passwordValid && passwordsMatch;

  function handleStep1Submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canContinue) return;
    setStep(2);
  }

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
    <>
      <p className="mb-2 text-center text-sm text-uva-text-muted">
        {step === 1
          ? "Paso 1 de 2 · Correo y contraseña"
          : "Paso 2 de 2 · Cuéntanos quién eres"}
      </p>

      <div aria-hidden="true" className="mb-2 flex gap-1.5">
        <div className="h-1 flex-1 rounded-full bg-uva-accent" />
        <div
          className={`h-1 flex-1 rounded-full ${step === 2 ? "bg-uva-accent" : "bg-uva-divider"}`}
        />
      </div>

      {step === 1 ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={handleStep1Submit}
        >
            <div>
              <Label htmlFor="reg-email">Correo</Label>
              <Input
                id="reg-email"
                name="email"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="reg-pass">Contraseña</Label>
              <PasswordInput
                id="reg-pass"
                name="password"
                placeholder="Mínimo 10 caracteres"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                inputClassName="h-9"
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
                inputClassName="h-9"
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
              disabled={!canContinue}
              className="mt-1.5 min-h-10 text-[15px]"
            >
              Continuar
            </Button>
        </form>
      ) : (
        <form className="flex flex-col gap-2" action={formAction}>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="password" value={password} />

            <div className="mb-2 inline-flex items-center gap-2.5 rounded-full bg-uva-success-soft px-3.5 py-2.5 text-[13px] text-uva-success-text">
              <span>Paso 2 · Cuéntanos quién eres</span>
            </div>

            {registroState?.error && (
              <div
                role="alert"
                className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-center text-[13px] text-uva-danger-text"
              >
                {registroState.error}
              </div>
            )}

            <div>
              <Label htmlFor="reg-name">¿Cómo te llamas?</Label>
              <Input
                id="reg-name"
                name="name"
                type="text"
                placeholder="Nombre y apellido"
                autoComplete="name"
                required
                className="h-9"
              />
            </div>
            <div>
              <Label htmlFor="reg-role">Tu rol en el gremio (opcional)</Label>
              <Input
                id="reg-role"
                name="role"
                type="text"
                placeholder="Arquitecto, residente, presupuestador…"
                className="h-9"
              />
            </div>

            <Button
              type="submit"
              variant="uva-primary"
              size="uva"
              disabled={pending}
              className="mt-1.5 min-h-10 text-[15px]"
            >
              {pending ? "Creando cuenta…" : "Crear mi cuenta"}
            </Button>
            <Button
              type="button"
              variant="uva-ghost"
              size="uva"
              className="mt-0.5"
              onClick={() => setStep(1)}
              disabled={pending}
            >
              ← Volver
            </Button>
        </form>
      )}

      <p className="mt-2 text-center text-[13px] text-uva-text-muted">
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </>
  );
}
