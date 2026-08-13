"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleIcon, CheckIcon, DotIcon } from "@/components/auth/icons";
import { passwordRules, isPasswordValid } from "@/lib/password";

export function RegistroForm() {
  const [step, setStep] = useState<1 | 2>(1);
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");

  const passwordValid = isPasswordValid(password);
  const passwordsMatch = password.length > 0 && password === password2;
  const canContinue = passwordValid && passwordsMatch;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step === 1) {
      if (!canContinue) return;
      setStep(2);
    }
  }

  return (
    <>
      <p className="auth-card__subtitle">
        {step === 1
          ? "Paso 1 de 2 · Correo y contraseña"
          : "Paso 2 de 2 · Cuéntanos quién eres"}
      </p>

      <div className="steps" aria-hidden="true">
        <div className="steps__bar is-active" />
        <div className={`steps__bar${step === 2 ? " is-active" : ""}`} />
      </div>

      {step === 1 && (
        <>
          <button type="button" className="btn btn-secondary">
            <GoogleIcon />
            Registrarme con Google
          </button>

          <div className="divider">
            <span>o con correo y contraseña</span>
          </div>
        </>
      )}

      <form className="form-fields" onSubmit={handleSubmit}>
        {step === 1 ? (
          <>
            <div className="field">
              <label htmlFor="reg-email">Correo</label>
              <input
                className="input"
                id="reg-email"
                name="email"
                type="email"
                placeholder="tu@correo.com"
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="reg-pass">Contraseña</label>
              <PasswordInput
                id="reg-pass"
                name="password"
                placeholder="Mínimo 10 caracteres"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />

              <ul className="password-requirements">
                {passwordRules.map((rule) => {
                  const met = rule.test(password);
                  const state = met
                    ? "is-valid"
                    : password.length > 0
                      ? "is-invalid"
                      : "";
                  return (
                    <li
                      key={rule.id}
                      className={`password-requirement ${state}`}
                    >
                      {met ? <CheckIcon /> : <DotIcon />}
                      {rule.label}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="field">
              <label htmlFor="reg-pass2">Repite la contraseña</label>
              <PasswordInput
                id="reg-pass2"
                name="password2"
                placeholder="Debe coincidir"
                autoComplete="new-password"
                value={password2}
                onChange={(event) => setPassword2(event.target.value)}
              />
              {password2.length > 0 && !passwordsMatch && (
                <p className="field-error">Las contraseñas no coinciden</p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canContinue}
            >
              Continuar
            </button>
          </>
        ) : (
          <>
            <div className="badge-success">
              <span>Paso 2 · Cuéntanos quién eres</span>
            </div>

            <div className="field">
              <label htmlFor="reg-name">¿Cómo te llamas?</label>
              <input
                className="input"
                id="reg-name"
                name="name"
                type="text"
                placeholder="Nombre y apellido"
                autoComplete="name"
              />
            </div>
            <div className="field">
              <label htmlFor="reg-role">Tu rol en el gremio (opcional)</label>
              <input
                className="input"
                id="reg-role"
                name="role"
                type="text"
                placeholder="Arquitecto, residente, presupuestador…"
              />
            </div>

            <button type="submit" className="btn btn-primary">
              Crear mi cuenta
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setStep(1)}
            >
              ← Volver
            </button>
          </>
        )}
      </form>

      <p className="auth-card__switch">
        ¿Ya tienes cuenta? <Link href="/login">Inicia sesión</Link>
      </p>
    </>
  );
}
