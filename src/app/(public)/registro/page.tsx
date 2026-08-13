import type { Metadata } from "next";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { RegistroForm } from "@/components/auth/RegistroForm";

export const metadata: Metadata = {
  title: "U.V.A. — Crear cuenta",
};

export default function RegistroPage() {
  return (
    <div className="grid grid-cols-1 min-[900px]:grid-cols-2 min-[901px]:h-dvh min-[901px]:overflow-hidden">
      <AuthVisual />

      <section className="grid place-items-center bg-[rgba(250,250,250,0.04)] p-7 min-[900px]:p-11 min-[901px]:overflow-hidden min-[901px]:px-11 min-[901px]:py-5">
        <div className="w-full max-w-[396px]">
          <h2 className="mb-1 text-center text-[24px] leading-[1.15] text-uva-text">
            Crea tu cuenta
          </h2>
          <RegistroForm />
        </div>
      </section>
    </div>
  );
}
