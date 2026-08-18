import type { Metadata } from "next";
import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/icons";

export const metadata: Metadata = {
  title: "U.V.A. — Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="grid min-h-screen grid-cols-1 min-[900px]:grid-cols-2">
      <AuthVisual />

      <section className="grid place-items-center bg-[rgba(250,250,250,0.04)] p-7 min-[900px]:p-11">
        <div className="w-full max-w-[396px]">
          <h2 className="mb-1.5 text-center text-[30px] text-uva-text">
            Inicia sesión
          </h2>
          <p className="mb-6 text-center text-sm text-uva-text-muted">
            Retoma tu ruta donde la dejaste.
          </p>

          <Button type="button" variant="uva-secondary" size="uva">
            <GoogleIcon />
            Continuar con Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-uva-divider" />
            <span className="text-[11px] whitespace-nowrap text-uva-text-faint">
              o con tu correo
            </span>
            <div className="h-px flex-1 bg-uva-divider" />
          </div>

          <LoginForm redirectTo={redirect?.startsWith("/") ? redirect : "/dashboard"} />

          <p className="mt-5 text-center text-[13px] text-uva-text-muted">
            ¿No tienes cuenta? <Link href="/registro">Créala gratis</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
