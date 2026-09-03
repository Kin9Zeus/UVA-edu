import type { Metadata } from "next";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { AuthFlow } from "@/components/auth/AuthFlow";

export const metadata: Metadata = {
  title: "U.V.A. — Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; email?: string; error?: string }>;
}) {
  const { redirect, email, error } = await searchParams;
  const redirectTo = redirect?.startsWith("/") ? redirect : "/dashboard";

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden min-[900px]:h-screen min-[900px]:flex-row min-[900px]:overflow-hidden">
      {/* Mobile: degradado de fondo detrás de todo — desktop no lo usa
          (AuthVisual ya trae los suyos, confinados a su propia sección). */}
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
          <AuthFlow redirectTo={redirectTo} initialEmail={email} initialError={error} />
        </div>
      </section>
    </div>
  );
}
