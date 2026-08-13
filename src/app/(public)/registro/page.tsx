import type { Metadata } from "next";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { RegistroForm } from "@/components/auth/RegistroForm";
import "@/styles/auth.css";

export const metadata: Metadata = {
  title: "U.V.A. — Crear cuenta",
};

export default function RegistroPage() {
  return (
    <div className="auth-shell auth-shell--fit">
      <AuthVisual />

      <section className="auth-form-panel">
        <div className="auth-card">
          <h2 className="auth-card__title">Crea tu cuenta</h2>
          <RegistroForm />
        </div>
      </section>
    </div>
  );
}
