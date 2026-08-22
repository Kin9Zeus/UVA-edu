import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { ActualizarPasswordForm } from "@/components/auth/ActualizarPasswordForm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "U.V.A. — Nueva contraseña",
};

export default async function ActualizarPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  // Camino normal: el enlace del correo pasa por /auth/confirm, que ya
  // canjea el token_hash y llega aquí con la sesión de recuperación puesta
  // en cookies (ver src/app/auth/confirm/route.ts).
  //
  // Camino de respaldo: si Supabase envía el correo con su plantilla propia
  // (p. ej. el "Send Email" hook no está configurado o no es alcanzable,
  // como al probar contra localhost), el enlace apunta directo aquí con
  // `?code=` (PKCE) en vez de pasar por /auth/confirm. Sin este canje, la
  // página carga igual pero no hay sesión y el guardado falla con "Tu
  // enlace expiró o no es válido" — por eso se cubre también este caso.
  const { code } = await searchParams;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "[actualizar-password] exchangeCodeForSession falló:",
        error.message,
      );
      redirect("/login?error=enlace_invalido");
    }

    redirect("/actualizar-password");
  }

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
