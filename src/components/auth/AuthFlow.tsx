"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegistroForm } from "@/components/auth/RegistroForm";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { checkEmail } from "@/actions/auth/check-email";

type Step = "email" | "login" | "signup" | "oauth" | "both";

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
    subtitle: "Elige una contraseña para tu cuenta nueva.",
  },
  oauth: {
    title: "¡Hola de nuevo!",
    subtitle: "Esta cuenta entra con Google.",
  },
  both: {
    title: "Ingresa a tu cuenta",
    subtitle: "Puedes continuar con Google o con tu contraseña.",
  },
};

export function AuthFlow({ redirectTo }: { redirectTo: string }) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCheckError(null);
    setChecking(true);

    const result = await checkEmail(email);

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

  function handleCambiar() {
    setStep("email");
    setCheckError(null);
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

          {step === "login" && (
            <LoginForm email={email} redirectTo={redirectTo} />
          )}

          {step === "signup" && (
            <RegistroForm email={email} redirectTo={redirectTo} />
          )}

          {step === "oauth" && (
            <GoogleAuthButton
              label="Continuar con Google"
              next={redirectTo}
            />
          )}

          {step === "both" && (
            <>
              <LoginForm email={email} redirectTo={redirectTo} />

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
