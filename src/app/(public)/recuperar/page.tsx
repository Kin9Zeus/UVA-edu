import type { Metadata } from "next";
import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { RecuperarForm } from "@/components/auth/RecuperarForm";
import "@/styles/auth.css";

export const metadata: Metadata = {
  title: "U.V.A. — Recuperar contraseña",
};

export default function RecuperarPage() {
  return (
    <div className="auth-shell">
      <AuthVisual />

      <section className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-card__title">Recupera tu contraseña</h2>
          <p className="auth-card__subtitle">
            Escribe el correo con el que te registraste y te enviamos un enlace
            para crear una nueva.
          </p>

          <RecuperarForm />

          <p className="auth-card__switch">
            <Link href="/login">Volver a iniciar sesión</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
