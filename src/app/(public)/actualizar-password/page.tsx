import type { Metadata } from "next";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { ActualizarPasswordForm } from "@/components/auth/ActualizarPasswordForm";

export const metadata: Metadata = {
  title: "U.V.A. — Nueva contraseña",
};

export default function ActualizarPasswordPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 min-[900px]:grid-cols-2">
      <AuthVisual />

      <section className="grid place-items-center bg-[rgba(250,250,250,0.04)] p-7 min-[900px]:p-11">
        <div className="w-full max-w-[396px]">
          <h2 className="mb-1.5 text-center text-[30px] text-uva-text">
            Crea tu nueva contraseña
          </h2>
          <p className="mb-6 text-center text-sm text-uva-text-muted">
            Esta será tu nueva contraseña para iniciar sesión en U.V.A.
          </p>

          <ActualizarPasswordForm />
        </div>
      </section>
    </div>
  );
}
