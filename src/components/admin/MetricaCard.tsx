import type { LucideIcon } from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";

/**
 * Tarjeta de KPI del panel: etiqueta arriba, cifra grande abajo, icono como
 * acento en la esquina.
 *
 * El mockup (design-spec/project/Uva - Panel Admin.dc.html) no dibuja las
 * tarjetas de la pantalla de usuarios — solo las del dashboard y las de la
 * ficha individual. En vez de inventar un diseño nuevo, esto extrae el que ya
 * usaba /admin para que las dos pantallas se lean igual.
 *
 * `detalle` es la línea de apoyo que el dashboard no necesitaba: en cupos y
 * acceso, la cifra sola no se interpreta sin saber sobre qué total va.
 */
export function MetricaCard({
  label,
  valor,
  detalle,
  icon: Icon,
  tono = "accent",
}: {
  label: string;
  valor: number | string;
  detalle?: string;
  icon: LucideIcon;
  /** `accent` para la cifra que importa; `neutral` para el contexto. */
  tono?: "accent" | "neutral";
}) {
  return (
    <AdminCard className="gap-2">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] text-uva-muted">{label}</p>
        <div
          className={
            tono === "accent"
              ? "flex size-9 shrink-0 items-center justify-center rounded-uva-md bg-uva-accent-soft text-uva-accent-text"
              : "flex size-9 shrink-0 items-center justify-center rounded-uva-md bg-uva-divider text-uva-muted"
          }
        >
          <Icon className="size-[18px]" strokeWidth={1.9} />
        </div>
      </div>
      <p className="font-mono text-[28px] leading-none font-bold tabular-nums">{valor}</p>
      {detalle && <p className="text-[12px] text-uva-muted-2">{detalle}</p>}
    </AdminCard>
  );
}
