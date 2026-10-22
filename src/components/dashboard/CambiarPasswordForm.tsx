"use client";

import { useActionState, useRef, useState } from "react";
import { KeyRound } from "lucide-react";
import { CLASE_BLOQUE_PERFIL, CLASE_CAMPO_PERFIL, CLASE_ETIQUETA_PERFIL } from "@/components/dashboard/PerfilForm";
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
export function CambiarPasswordForm({ tienePassword }: { tienePassword: boolean }) {
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

  const titulo = (
    <h2 id="perfil-clave-titulo" className="flex items-center gap-2.5 text-uva-titulo-4 font-extrabold text-uva-text">
      <KeyRound className="size-5 text-uva-text-muted" strokeWidth={1.8} aria-hidden />
      Contraseña
    </h2>
  );

  // Cuenta creada con Google: no hay contraseña actual que verificar, así que
  // el formulario no tiene sentido (y la acción tampoco lo aceptaría).
  if (!tienePassword) {
    return (
      <section aria-labelledby="perfil-clave-titulo" className={CLASE_BLOQUE_PERFIL}>
        {titulo}
        <p className="max-w-[68ch] text-uva-cuerpo text-uva-text-muted">
          Entras con tu cuenta de Google, por eso no tienes una contraseña en U.V.A. Google
          protege tu acceso. Si prefieres entrar también con correo y contraseña, usa «¿Olvidaste
          tu contraseña?» en la pantalla de inicio de sesión y te enviamos un enlace para crearla.
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="perfil-clave-titulo" className={CLASE_BLOQUE_PERFIL}>
      {titulo}

      {/* Plegado hasta que se pide: casi nadie cambia la contraseña y los tres
          campos empujaban el resto del perfil. Se queda abierto mientras haya
          un error o un aviso que leer. */}
      <details className="group/clave" open={Boolean(state?.error || state?.success) || undefined}>
        <summary className="inline-flex min-h-12 cursor-pointer list-none items-center rounded-uva-md border-[1.5px] border-uva-line-strong px-[22px] text-base font-semibold text-uva-text hover:border-uva-text group-open/clave:hidden [&::-webkit-details-marker]:hidden">
          Cambiar contraseña
        </summary>
      <form ref={formRef} action={handleAction} className="flex flex-col gap-4" noValidate>
        {state?.error && (
          <div
            role="alert"
            className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-uva-detalle text-uva-danger-text"
          >
            {state.error}
          </div>
        )}

        <div>
          <Label htmlFor="perfil-password-actual" className={CLASE_ETIQUETA_PERFIL}>
            Contraseña actual
          </Label>
          <PasswordInput
            id="perfil-password-actual"
            name="password_actual"
            placeholder="••••••••"
            autoComplete="current-password"
            required
            inputClassName={CLASE_CAMPO_PERFIL}
          />
        </div>

        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
          <div>
            <Label htmlFor="perfil-password-nueva" className={CLASE_ETIQUETA_PERFIL}>
              Nueva contraseña
            </Label>
            <PasswordInput
              id="perfil-password-nueva"
              name="password_nueva"
              placeholder="Mínimo 10 caracteres"
              autoComplete="new-password"
              value={passwordNueva}
              onChange={(event) => setPasswordNueva(event.target.value)}
              required
              inputClassName={CLASE_CAMPO_PERFIL}
            />
          </div>
          <div>
            <Label htmlFor="perfil-password-nueva2" className={CLASE_ETIQUETA_PERFIL}>
              Repite la contraseña
            </Label>
            <PasswordInput
              id="perfil-password-nueva2"
              name="password_nueva2"
              placeholder="Debe coincidir"
              autoComplete="new-password"
              value={passwordNueva2}
              onChange={(event) => setPasswordNueva2(event.target.value)}
              required
              inputClassName={CLASE_CAMPO_PERFIL}
            />
            {passwordNueva2.length > 0 && !passwordsMatch && (
              <p className="mt-1.5 text-uva-detalle text-uva-danger-text">Las contraseñas no coinciden</p>
            )}
          </div>
        </div>

        <ul className="grid grid-cols-1 gap-x-3 gap-y-1 min-[420px]:grid-cols-2">
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
                className={`flex items-center gap-1.5 text-uva-detalle leading-[1.3] transition-colors duration-150 [transition-timing-function:ease] motion-reduce:transition-none [&_svg]:size-3.5 [&_svg]:shrink-0 ${colorClass}`}
              >
                {met ? <CheckIcon /> : <DotIcon />}
                {rule.label}
              </li>
            );
          })}
        </ul>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="submit"
            variant="uva-primary"
            size="uva"
            disabled={!canSubmit || pending}
            className="min-h-12 w-auto px-[22px] text-base"
          >
            {pending ? "Guardando…" : "Cambiar contraseña"}
          </Button>
          {state?.success && (
            <span role="status" className="text-uva-cuerpo font-bold text-uva-text">
              Contraseña actualizada
            </span>
          )}
        </div>
      </form>
      </details>
    </section>
  );
}
