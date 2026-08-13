import type { Metadata } from "next";
import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { GoogleIcon } from "@/components/auth/icons";
import "@/styles/auth.css";

export const metadata: Metadata = {
  title: "U.V.A. — Iniciar sesión",
};

export default function LoginPage() {
  return (
    <div className="auth-shell">
      <AuthVisual />

      <section className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-card__title">Inicia sesión</h2>
          <p className="auth-card__subtitle">
            Retoma tu ruta donde la dejaste.
          </p>

          <button type="button" className="btn btn-secondary">
            <GoogleIcon />
            Continuar con Google
          </button>

          <div className="divider">
            <span>o con tu correo</span>
          </div>

          <form className="form-fields">
            <div className="field">
              <label htmlFor="login-email">Correo</label>
              <input
                className="input"
                id="login-email"
                name="email"
                type="email"
                placeholder="Ingresa tu correo electrónico"
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="login-pass">Contraseña</label>
              <PasswordInput
                id="login-pass"
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className="field-row-end">
              <Link href="/recuperar">¿Olvidaste tu contraseña?</Link>
            </div>

            <button type="submit" className="btn btn-primary">
              Entrar
            </button>
          </form>

          <p className="auth-card__switch">
            ¿No tienes cuenta? <Link href="/registro">Créala gratis</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
