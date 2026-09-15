import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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
 * `detalle` es la línea de apoyo sin la cual la cifra no se interpreta: un
 * "214" no dice nada hasta saber sobre qué total va.
 *
 * `href` convierte la tarjeta en el atajo a su sección. Una métrica de
 * dashboard casi siempre provoca la misma pregunta —"¿cuáles son?"— y dejarla
 * sin salida obliga a buscar la sección a mano en el menú.
 */
export function MetricaCard({
  label,
  valor,
  detalle,
  icon: Icon,
  tono = "accent",
  href,
  variant = "card",
}: {
  label: string;
  valor: number | string;
  detalle?: string;
  icon: LucideIcon;
  /** `accent` para la cifra que importa; `neutral` para el contexto. */
  tono?: "accent" | "neutral";
  /** Sección donde se ven los registros detrás de la cifra. */
  href?: string;
  /**
   * `card` (por defecto): borde y fondo propios — lo que usa /admin/usuarios,
   * donde cada métrica es un objeto aparte junto a la tabla de abajo.
   * `flush`: sin borde ni fondo. Para una fila de resumen donde las cifras se
   * separan con divisores en vez de con cajas — ver el dashboard, que abría
   * con 4 tarjetas más las 2 de contenido: demasiada caja antes de leer nada.
   * Como ya no hay borde que resalte al pasar el mouse, el enlace cambia de
   * color en su lugar.
   */
  variant?: "card" | "flush";
}) {
  const esFlush = variant === "flush";

  // En `flush` el icono es un adorno parejo en las 4 tarjetas, no una marca
  // de cuál es "la que manda" — esa jerarquía la da el color en el número al
  // pasar el mouse, no un icono distinto. `tono` sigue rigiendo el icono en
  // `card` (lo que usa /admin/usuarios).
  const iconoAccent = esFlush || tono === "accent";

  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] text-uva-muted">{label}</p>
        <div
          className={
            iconoAccent
              ? "flex size-9 shrink-0 items-center justify-center rounded-uva-md bg-uva-accent-soft text-uva-accent-text"
              : "flex size-9 shrink-0 items-center justify-center rounded-uva-md bg-uva-divider text-uva-muted"
          }
        >
          <Icon className="size-[18px]" strokeWidth={1.9} />
        </div>
      </div>
      <p
        className={cn(
          "font-mono text-[28px] leading-none font-bold tabular-nums text-uva-text",
          esFlush && href && "transition-colors group-hover:text-uva-accent-text",
        )}
      >
        {valor}
      </p>
      {detalle && <p className="text-[12px] text-uva-muted-2">{detalle}</p>}
    </>
  );

  if (esFlush) {
    if (!href) return <div className="flex flex-col gap-2 px-4 py-3 lg:px-5">{contenido}</div>;

    // `group` para que la cifra cambie de color al pasar el mouse — el aviso
    // de "esto es clicable" que antes daba el borde de la tarjeta. Solo la
    // cifra, no la etiqueta: es lo que se lee primero.
    return (
      <Link
        href={href}
        className="group flex flex-col gap-2 rounded-uva-md px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent lg:px-5"
      >
        {contenido}
      </Link>
    );
  }

  if (!href) return <AdminCard className="gap-2">{contenido}</AdminCard>;

  // El enlace envuelve la tarjeta en vez de ir dentro: así toda la superficie
  // es el área de clic, y no solo la etiqueta. `h-full` porque el elemento de
  // la rejilla pasa a ser el <a>, y sin él la tarjeta dejaría de estirarse
  // hasta la altura de sus hermanas.
  return (
    <Link
      href={href}
      className="rounded-uva-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
    >
      <AdminCard className="h-full gap-2 transition-colors hover:border-uva-text-faint">
        {contenido}
      </AdminCard>
    </Link>
  );
}
