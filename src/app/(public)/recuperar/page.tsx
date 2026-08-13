import type { Metadata } from "next";
import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { RecuperarForm } from "@/components/auth/RecuperarForm";

export const metadata: Metadata = {
  title: "U.V.A. — Recuperar contraseña",
};

export default function RecuperarPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 min-[900px]:grid-cols-2">
      <AuthVisual />

      <section className="grid place-items-center bg-[rgba(250,250,250,0.04)] p-7 min-[900px]:p-11">
        <div className="w-full max-w-[396px]">
          <h2 className="mb-1.5 text-center text-[30px] text-uva-text">
            Recupera tu contraseña
          </h2>
          <p className="mb-6 text-center text-sm text-uva-text-muted">
            Escribe el correo con el que te registraste y te enviamos un
            enlace para crear una nueva.
          </p>

          <RecuperarForm />

          <p className="mt-5 text-center text-[13px] text-uva-text-muted">
            <Link href="/login">Volver a iniciar sesión</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
