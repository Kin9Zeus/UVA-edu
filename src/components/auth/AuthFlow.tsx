"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegistroForm } from "@/components/auth/RegistroForm";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { ReenviarVerificacion } from "@/components/auth/ReenviarVerificacion";
import { checkEmail } from "@/actions/auth/check-email";

type Step =
  | "email"
  | "login"
  | "signup"
  | "oauth"
  | "both"
  | "confirmar"
  | "pendiente";

const STEP_COPY: Record<Step, { title: string; subtitle: string }> = {
  email: {
    title: "Inicia sesión o crea tu cuenta",
    subtitle: "Retoma tu ruta donde la dejaste.",
  },
  login: {
    title: "Ingresa a tu cuenta",
    subtitle: "Escribe tu contraseña para continuar.",
  },
  signup: {
    title: "Vamos a crear tu cuenta",
    subtitle: "Completa tus datos para tu cuenta nueva.",
  },
  oauth: {
    title: "¡Hola de nuevo!",
    subtitle: "Esta cuenta entra con Google.",
  },
  both: {
    title: "Ingresa a tu cuenta",
    subtitle: "Puedes continuar con Google o con tu contraseña.",
  },
  confirmar: {
    title: "¡Ya casi!",
    subtitle: "Creamos tu cuenta. Revisa tu correo y confírmala para poder iniciar sesión.",
  },
  pendiente: {
    title: "Verifica tu correo",
    subtitle: "Tu cuenta está creada, pero falta confirmar tu correo para entrar.",
  },
};

/**
 * Mensajes para el `?error=` que agregan los redirects de enlaces de correo
 * fallidos: token ya usado, vencido, o simplemente inválido —
 * verifyOtp()/exchangeCodeForSession() no distingue el motivo exacto, así
 * que los tres caen en el mismo código (auth/confirm/route.ts,
 * actualizar-password/page.tsx, auth/callback/route.ts). Antes de esto
 * `?error=enlace_invalido` no se leía en ningún lado y el usuario caía en
 * /login sin ninguna explicación (docs/qa/bugs-e2e.md, BUG-001).
 */
const MENSAJES_ERROR_QUERY: Record<string, string> = {
  enlace_invalido: "Ese enlace ya no es válido o ya venció. Pide uno nuevo.",
};

export function AuthFlow({
  redirectTo,
  initialEmail,
  initialError,
}: {
  redirectTo: string;
  initialEmail?: string;
  initialError?: string;
}) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail ?? "");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(
    initialError ? (MENSAJES_ERROR_QUERY[initialError] ?? null) : null,
  );

  async function runCheckEmail(correo: string) {
    setCheckError(null);
    setChecking(true);

    const result = await checkEmail(correo);

    setChecking(false);

    if ("error" in result) {
      setCheckError(result.error);
      return;
    }

    if (!result.exists) {
      setStep("signup");
    } else if (result.provider === "both") {
      setStep("both");
    } else if (result.provider === "google") {
      setStep("oauth");
    } else {
      setStep("login");
    }
  }

  function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runCheckEmail(email);
  }

  // Viene de confirmar el correo (registro.ts / reenviar-verificacion.ts
  // agregan ?email= al redirect): salta directo al paso de contraseña en
  // vez de obligar a volver a escribir el correo. Se difiere a un
  // microtask para que el primer setState de runCheckEmail no corra de
  // forma síncrona dentro del efecto (evita el cascading-render que marca
  // react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!initialEmail) return;
    queueMicrotask(() => runCheckEmail(initialEmail));
  }, [initialEmail]);

  function handleCambiar() {
    setStep("email");
    setCheckError(null);
  }

  function handleCrearCuenta() {
    setCheckError(null);
    setStep("signup");
  }

  function handleCuentaCreada(correo: string) {
    setEmail(correo);
    setStep("confirmar");
  }

  function handlePendienteVerificacion() {
    setStep("pendiente");
  }

  const { title, subtitle } = STEP_COPY[step];

  return (
    <>
      <h2 className="mb-1.5 text-center text-[30px] text-uva-text">
        {title}
      </h2>
      <p className="mb-6 text-center text-sm text-uva-text-muted">
        {subtitle}
      </p>

      {step === "email" ? (
        <>
          <form
            className="flex flex-col gap-3.5"
            onSubmit={handleEmailSubmit}
            noValidate
          >
            {checkError && (
              <div
                role="alert"
                className="rounded-uva-md bg-uva-danger-soft px-3.5 py-2.5 text-center text-[13px] text-uva-danger-text"
              >
                {checkError}
              </div>
            )}

            <div>
              <Label htmlFor="auth-email">Correo electrónico</Label>
              <Input
                id="auth-email"
                name="email"
                type="email"
                placeholder="Ingresa tu correo electrónico"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <Button
              type="submit"
              variant="uva-primary"
              size="uva"
              disabled={checking}
              className="mt-2.5 min-h-[46px] text-[15px]"
            >
              {checking ? "Verificando…" : "Continuar"}
            </Button>
          </form>

          <p className="mt-4 text-center text-[13px] text-uva-text-muted">
            ¿No tienes cuenta?{" "}
            <button
              type="button"
              onClick={handleCrearCuenta}
              className="text-uva-accent hover:underline"
            >
              Crear cuenta
            </button>
          </p>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-uva-divider" />
            <span className="text-[11px] whitespace-nowrap text-uva-text-faint">
              o continúa con
            </span>
            <div className="h-px flex-1 bg-uva-divider" />
          </div>

          <GoogleAuthButton
            label="Continuar con Google"
            next={redirectTo}
          />
        </>
      ) : (
        <>
          {step !== "signup" && step !== "confirmar" && step !== "pendiente" && (
            <div className="mb-4 flex items-center justify-between gap-2 rounded-uva-md border border-uva-divider bg-uva-surface/40 px-3.5 py-2.5 text-sm text-uva-text">
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={handleCambiar}
                className="shrink-0 text-xs text-uva-accent hover:underline"
              >
                Cambiar
              </button>
            </div>
          )}

          {step === "login" && (
            <LoginForm
              email={email}
              redirectTo={redirectTo}
              onPendienteVerificacion={handlePendienteVerificacion}
            />
          )}

          {step === "signup" && (
            <>
              <RegistroForm
                email={email}
                redirectTo={redirectTo}
                onCuentaCreada={handleCuentaCreada}
              />
              <p className="mt-4 text-center text-[13px] text-uva-text-muted">
                ¿Ya tienes cuenta?{" "}
                <button
                  type="button"
                  onClick={handleCambiar}
                  className="text-uva-accent hover:underline"
                >
                  Inicia sesión
                </button>
              </p>
            </>
          )}

          {step === "confirmar" && (
            <>
              <div
                role="status"
                className="rounded-uva-md bg-uva-success-soft px-4 py-3.5 text-center text-[13px] leading-[1.5] text-uva-success-text"
              >
                Te enviamos un correo de confirmación a {email || "tu correo"}.
              </div>
              <ReenviarVerificacion email={email} />
            </>
          )}

          {step === "pendiente" && (
            <>
              <div
                role="status"
                className="rounded-uva-md bg-uva-danger-soft px-4 py-3.5 text-center text-[13px] leading-[1.5] text-uva-danger-text"
              >
                Aún no confirmas {email || "tu correo"}. Revisa tu bandeja o
                pide un nuevo enlace.
              </div>
              <ReenviarVerificacion email={email} />
            </>
          )}

          {step === "oauth" && (
            <GoogleAuthButton
              label="Continuar con Google"
              next={redirectTo}
            />
          )}

          {step === "both" && (
            <>
              <LoginForm
                email={email}
                redirectTo={redirectTo}
                onPendienteVerificacion={handlePendienteVerificacion}
              />

              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-uva-divider" />
                <span className="text-[11px] whitespace-nowrap text-uva-text-faint">
                  o continúa con
                </span>
                <div className="h-px flex-1 bg-uva-divider" />
              </div>

              <GoogleAuthButton
                label="Continuar con Google"
                next={redirectTo}
              />
            </>
          )}
        </>
      )}
    </>
  );
}
