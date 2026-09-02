import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { ActualizarPasswordForm } from "@/components/auth/ActualizarPasswordForm";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

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
      logError("actualizar-password", "exchangeCodeForSession falló", error);
      redirect("/login?error=enlace_invalido");
    }

    redirect("/actualizar-password");
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden min-[900px]:h-screen min-[900px]:flex-row min-[900px]:overflow-hidden">
      {/* Mobile: degradado de fondo detrás de todo — desktop no lo usa
          (AuthVisual ya trae los suyos, confinados a su propia sección).
          Mismo tratamiento que /login y /recuperar (ver esos page.tsx). */}
      <div
        aria-hidden="true"
        className="absolute -top-[80px] -right-[100px] h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,0,122,0.24),transparent_70%)] min-[900px]:hidden"
      />
      <div
        aria-hidden="true"
        className="absolute top-[220px] -left-[80px] h-[260px] w-[260px] rounded-full opacity-60 bg-[radial-gradient(circle_at_60%_40%,rgba(242,192,18,0.22),transparent_75%)] min-[900px]:hidden"
      />

      <AuthVisual />

      <section className="relative z-[2] grid flex-1 place-items-center px-5 pt-3 pb-10 min-[900px]:overflow-y-auto min-[900px]:bg-[rgba(250,250,250,0.04)] min-[900px]:p-11 min-[900px]:[place-items:safe_center]">
        <div className="w-full max-w-[396px] rounded-uva-lg border border-uva-divider bg-uva-surface/90 px-6 py-7 shadow-xl backdrop-blur-sm min-[900px]:rounded-none min-[900px]:border-0 min-[900px]:bg-transparent min-[900px]:px-0 min-[900px]:py-4 min-[900px]:shadow-none min-[900px]:backdrop-blur-none">
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
