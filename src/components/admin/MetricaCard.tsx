import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Una cifra de la fila de resumen del panel: etiqueta arriba, cifra grande
 * abajo, icono en magenta como adorno de la fila —no marca jerarquía, es
 * parejo en las 4—. Sin borde ni fondo propios: vive junto a sus hermanas
 * separada por un divisor (ver `admin/page.tsx` y `admin/usuarios/page.tsx`,
 * que arman la cuadrícula con `nth-child` alrededor de este componente), no
 * como una tarjeta aparte.
 *
 * `detalle` es la línea de apoyo sin la cual la cifra no se interpreta: un
 * "214" no dice nada hasta saber sobre qué total va.
 *
 * `href` convierte la cifra en el atajo a su sección. Una métrica de
 * dashboard casi siempre provoca la misma pregunta —"¿cuáles son?"— y dejarla
 * sin salida obliga a buscar la sección a mano en el menú. Como no hay borde
 * que resalte al pasar el mouse, el número cambia a magenta en su lugar
 * —solo el número, no la etiqueta, porque es lo que se lee primero—; sin
 * `href` la cifra no reacciona, y esa quietud es la pista de que no lleva a
 * ningún lado.
 */
export function MetricaCard({
  label,
  valor,
  detalle,
  icon: Icon,
  href,
}: {
  label: string;
  valor: number | string;
  detalle?: string;
  icon: LucideIcon;
  /** Sección donde se ven los registros detrás de la cifra. */
  href?: string;
}) {
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] text-uva-muted">{label}</p>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-uva-md bg-uva-accent-soft text-uva-accent-text">
          <Icon className="size-[18px]" strokeWidth={1.9} />
        </div>
      </div>
      <p
        className={cn(
          "font-mono text-[28px] leading-none font-bold tabular-nums text-uva-text",
          href && "transition-colors group-hover:text-uva-accent-text",
        )}
      >
        {valor}
      </p>
      {detalle && <p className="text-[12px] text-uva-muted-2">{detalle}</p>}
    </>
  );

  if (!href) return <div className="flex flex-col gap-2 px-4 py-3 lg:px-5">{contenido}</div>;

  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-uva-md px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent lg:px-5"
    >
      {contenido}
    </Link>
  );
}
