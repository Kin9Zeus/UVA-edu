import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Contenido del aviso de período de gracia, compartido entre la tarjeta fija
 * del Sidebar (desktop) y el popover del ícono de alerta (mobile, ver
 * GraciaAlerta.tsx) para que ambos se vean idénticos.
 */
export function GraciaCard({ diasGracia }: { diasGracia: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface-2 p-[18px]">
      <span className="inline-flex w-fit items-center gap-2 rounded-uva-sm border border-uva-accent-2/40 bg-uva-accent-2-soft px-[11px] py-1.5 font-mono text-[10px] font-semibold tracking-[.16em] text-uva-accent-2-text uppercase">
        <span className="size-1.5 bg-uva-accent-2" />
        Período de gracia
      </span>
      <p className="text-[13px] text-uva-muted">
        Quedan {diasGracia} {diasGracia === 1 ? "día" : "días"} de acceso.
      </p>
      <Button
        render={<Link href="/dashboard/planes" />}
        nativeButton={false}
        variant="uva-primary"
        size="sm"
        className="text-[13.5px]"
      >
        Ver planes
      </Button>
    </div>
  );
}
