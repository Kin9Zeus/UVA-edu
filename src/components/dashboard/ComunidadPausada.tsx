import Link from "next/link";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const MOTIVO_COPY: Record<"SIN_SUSCRIPCION" | "VENCIDA" | "CANCELADA", string> = {
  SIN_SUSCRIPCION: "Todavía no tienes una suscripción activa.",
  VENCIDA: "Tu suscripción está vencida.",
  CANCELADA: "Tu suscripción fue cancelada.",
};

export function ComunidadPausada({ motivo }: { motivo: keyof typeof MOTIVO_COPY }) {
  return (
    <div className="mx-auto flex max-w-[760px] flex-col items-center gap-4 px-[clamp(20px,3vw,44px)] py-16 text-center">
      <div className="flex flex-col items-center gap-4 rounded-uva-md border border-uva-divider bg-uva-surface px-9 py-11">
        <div className="flex size-[84px] items-center justify-center rounded-full bg-uva-accent-soft text-uva-accent">
          <Users className="size-8" strokeWidth={2} />
        </div>
        <h2 className="text-2xl text-uva-text">Tu acceso a la comunidad está en pausa</h2>
        <p className="max-w-[460px] text-sm text-uva-text-muted">
          {MOTIVO_COPY[motivo]} Suscríbete o reactiva tu plan para volver a entrar a los canales
          del gremio.
        </p>
        <Button
          render={<Link href="/planes" />}
          nativeButton={false}
          variant="uva-primary"
          size="uva"
          className="mt-2 w-auto px-6"
        >
          Ver planes
        </Button>
      </div>
      <p className="text-xs text-uva-text-faint">
        Canales segmentados por oficio y región. Se activan cuando tu acceso esté vigente.
      </p>
    </div>
  );
}
