import type { Metadata } from "next";
import { AuthVisual } from "@/components/auth/AuthVisual";
import { Button } from "@/components/ui/button";
import { confirmarEnlace } from "@/actions/auth/confirmar-enlace";

export const metadata: Metadata = {
  title: "U.V.A. — Confirmar",
};

export default async function ConfirmarEnlacePage({
  searchParams,
}: {
  searchParams: Promise<{
    code?: string;
    token_hash?: string;
    type?: string;
    next?: string;
  }>;
}) {
  const { code, token_hash: tokenHash, type, next } = await searchParams;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden min-[900px]:h-screen min-[900px]:flex-row min-[900px]:overflow-hidden">
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
        <div className="w-full max-w-[396px] rounded-uva-lg border border-uva-divider bg-uva-surface/90 px-6 py-7 text-center shadow-xl backdrop-blur-sm min-[900px]:rounded-none min-[900px]:border-0 min-[900px]:bg-transparent min-[900px]:px-0 min-[900px]:py-4 min-[900px]:shadow-none min-[900px]:backdrop-blur-none">
          <h2 className="mb-1.5 text-[30px] text-uva-text">Confirma tu enlace</h2>
          <p className="mb-6 text-sm text-uva-text-muted">
            Pulsa el botón para completar la verificación. Este paso extra
            evita que un escáner de seguridad de tu correo la haga por ti sin
            que lo notes, dejando el enlace inválido antes de que lo abras.
          </p>

          <form action={confirmarEnlace} className="flex flex-col gap-3.5">
            <input type="hidden" name="code" value={code ?? ""} />
            <input type="hidden" name="tokenHash" value={tokenHash ?? ""} />
            <input type="hidden" name="type" value={type ?? ""} />
            <input type="hidden" name="next" value={next ?? ""} />

            <Button
              type="submit"
              variant="uva-primary"
              size="uva"
              className="min-h-[46px] w-full text-[15px]"
            >
              Confirmar
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
