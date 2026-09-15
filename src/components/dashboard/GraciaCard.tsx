import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Contenido del aviso de período de gracia, compartido entre la tarjeta fija
 * del Sidebar (desktop) y el popover de NotificacionesBell (mobile, ver
 * NotificacionesBell.tsx) para que ambos se vean idénticos.
 */
export function GraciaCard({ diasGracia }: { diasGracia: number }) {
  // 0 no es "hoy es tu último día": calcularDiasGracia (src/lib/gracia.ts) ya
  // acotó a 0 un período que terminó, y suscripcionDaAcceso ya le está
  // negando el contenido en ese mismo instante — "Quedan 0 días de acceso"
  // le mentía diciéndole que todavía tenía algo, cuando el resto de la
  // plataforma (video, certificados) ya lo trata como si no tuviera
  // suscripción. A partir de acá el aviso pasa a informar, no a advertir.
  const vencido = diasGracia <= 0;

  return (
    <div className="flex flex-col gap-3 rounded-uva-md border border-uva-divider bg-uva-surface-2 p-[18px]">
      <span
        className={
          vencido
            ? "inline-flex w-fit items-center gap-2 rounded-uva-sm border border-uva-badge-danger-fg/40 bg-uva-badge-danger-bg px-[11px] py-1.5 font-mono text-[10px] font-semibold tracking-[.16em] text-uva-badge-danger-fg uppercase"
            : "inline-flex w-fit items-center gap-2 rounded-uva-sm border border-uva-accent-2/40 bg-uva-accent-2-soft px-[11px] py-1.5 font-mono text-[10px] font-semibold tracking-[.16em] text-uva-accent-2-text uppercase"
        }
      >
        <span className={vencido ? "size-1.5 bg-uva-badge-danger-fg" : "size-1.5 bg-uva-accent-2"} />
        {vencido ? "Plan vencido" : "Período de gracia"}
      </span>
      <p className="text-[13px] text-uva-muted">
        {vencido
          ? "Tu período de gracia terminó y tu plan venció. Renuévalo para seguir viendo el contenido."
          : `Quedan ${diasGracia} ${diasGracia === 1 ? "día" : "días"} de acceso.`}
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
