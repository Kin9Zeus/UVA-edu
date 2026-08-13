import type { Metadata } from "next";
import Link from "next/link";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/auth/icons";

export const metadata: Metadata = {
  title: "U.V.A. — Iniciar sesión",
};

export default function LoginPage() {
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

          <form className="flex flex-col gap-3.5">
            <div>
              <Label htmlFor="login-email">Correo</Label>
              <Input
                id="login-email"
                name="email"
                type="email"
                placeholder="Ingresa tu correo electrónico"
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="login-pass">Contraseña</Label>
              <PasswordInput
                id="login-pass"
                name="password"
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            <div className="mt-2.5 flex justify-end">
              <Link href="/recuperar" className="text-xs">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            <Button
              type="submit"
              variant="uva-primary"
              size="uva"
              className="mt-4 min-h-[46px] text-[15px]"
            >
              Entrar
            </Button>
          </form>

          <p className="mt-5 text-center text-[13px] text-uva-text-muted">
            ¿No tienes cuenta? <Link href="/registro">Créala gratis</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
