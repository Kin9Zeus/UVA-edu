"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { CheckIcon, DotIcon } from "@/components/auth/icons";
import { passwordRules, isPasswordValid } from "@/lib/password";
import { registro, type RegistroState } from "@/actions/auth/registro";

export function RegistroForm({
  email,
  redirectTo,
  onCuentaCreada,
}: {
  email: string;
  redirectTo: string;
  onCuentaCreada?: (email: string) => void;
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

  useEffect(() => {
    if (registroState?.needsConfirmation) {
      onCuentaCreada?.(registroState.email);
    }
  }, [registroState, onCuentaCreada]);

  if (registroState?.needsConfirmation) {
    return null;
  }

  return (
    <form className="flex flex-col gap-2" action={formAction}>
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
        <Label htmlFor="reg-email">Correo electrónico</Label>
        <Input
          id="reg-email"
          name="email"
          type="email"
          placeholder="Ingresa tu correo electrónico"
          autoComplete="email"
          defaultValue={email}
          required
        />
      </div>

      <div>
        <Label htmlFor="reg-nombre">Nombre completo</Label>
        <Input
          id="reg-nombre"
          name="nombre"
          placeholder="Tu nombre y apellido"
          autoComplete="name"
          required
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

      {/* El <label> entero es el área táctil (44 px de alto); la casilla
          nativa conserva Espacio para marcarla y el foco visible global. */}
      <label
        htmlFor="reg-terminos"
        className="mt-1.5 flex min-h-11 items-start gap-2 py-1 text-[12px] leading-[1.4] text-uva-text-muted"
      >
        <input
          id="reg-terminos"
          name="terminos"
          type="checkbox"
          required
          checked={aceptaTerminos}
          onChange={(event) => setAceptaTerminos(event.target.checked)}
          className="mt-0.5 size-4 shrink-0 accent-uva-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        />
        <span>
          Acepto los{" "}
          <Link href="/soporte?tema=terminos" className="underline" target="_blank">
            Términos
          </Link>{" "}
          y la{" "}
          <Link href="/soporte?tema=privacidad" className="underline" target="_blank">
            Política de privacidad
          </Link>
        </span>
      </label>

      <Button
        type="submit"
        variant="uva-primary"
        size="uva"
        disabled={!canSubmit || pending}
        aria-describedby={aceptaTerminos ? undefined : "reg-terminos-ayuda"}
        className="mt-1.5 min-h-10 text-[15px]"
      >
        {pending ? "Creando cuenta…" : "Crear mi cuenta"}
      </Button>
      {/* El botón deshabilitado no recibe foco con Tab: sin este texto quien
          navega con teclado no sabe por qué no puede avanzar. */}
      {!aceptaTerminos && (
        <p
          id="reg-terminos-ayuda"
          className="mb-0 text-center text-xs text-uva-text-muted"
        >
          Acepta los Términos y la Política de privacidad para crear tu cuenta.
        </p>
      )}
    </form>
  );
}
