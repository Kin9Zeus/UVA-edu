import type { Metadata } from "next";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { AuthFlow } from "@/components/auth/AuthFlow";

export const metadata: Metadata = {
  title: "U.V.A. — Iniciar sesión",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const redirectTo = redirect?.startsWith("/") ? redirect : "/dashboard";

  return (
    <div className="flex min-h-screen flex-col min-[900px]:h-screen min-[900px]:flex-row min-[900px]:overflow-hidden">
      <AuthVisual />

      <section className="grid place-items-center bg-[rgba(250,250,250,0.04)] p-7 min-[900px]:flex-1 min-[900px]:overflow-y-auto min-[900px]:p-11 min-[900px]:[place-items:safe_center]">
        <div className="w-full max-w-[396px] py-4">
          <AuthFlow redirectTo={redirectTo} />
        </div>
      </section>
    </div>
  );
}
