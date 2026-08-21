import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { ReenviarVerificacion } from "@/components/auth/ReenviarVerificacion";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "U.V.A. — Verifica tu correo",
};

export default async function VerificarCorreoPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  if (user.email_confirmed_at) {
    redirect("/dashboard");
  }

  return (
    <div className="grid min-h-screen grid-cols-1 min-[900px]:grid-cols-2">
      <AuthVisual />

      <section className="grid place-items-center bg-[rgba(250,250,250,0.04)] p-7 min-[900px]:p-11">
        <div className="w-full max-w-[396px] text-center">
          <h2 className="mb-1.5 text-[30px] text-uva-text">
            Verifica tu correo
          </h2>
          <p className="mb-6 text-sm text-uva-text-muted">
            Enviamos un enlace de confirmación a{" "}
            <span className="text-uva-text">{user.email}</span>. Ábrelo para
            activar tu cuenta.
          </p>

          <ReenviarVerificacion email={user.email ?? ""} />
        </div>
      </section>
    </div>
  );
}
