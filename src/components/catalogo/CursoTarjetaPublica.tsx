import Link from "next/link";
import Image from "next/image";
import type { CategoriaChip, CursoDeCategoria } from "@/lib/categoria";
import { esPortadaReal } from "@/lib/media";
import { formatHoras } from "@/lib/admin/format";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import { cn } from "@/lib/utils";

const NIVEL = {
  BASICO: { etiqueta: "Básico", barras: 1 },
  INTERMEDIO: { etiqueta: "Intermedio", barras: 2 },
  AVANZADO: { etiqueta: "Avanzado", barras: 3 },
} as const;

/** Retícula de plano para la portada de un curso sin imagen. */
const RETICULA = {
  backgroundImage:
    "linear-gradient(color-mix(in srgb, var(--uva-line-strong) 25%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--uva-line-strong) 25%, transparent) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

/** Tres barras de alto creciente; se rellenan tantas como el nivel. El texto del nivel va al lado. */
function BarrasNivel({ nivel, className }: { nivel: CursoDeCategoria["nivel"]; className?: string }) {
  const llenas = NIVEL[nivel].barras;
  return (
    <span aria-hidden="true" className={cn("inline-flex items-end gap-[3px]", className)}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "w-1.5 max-md:w-[5px]",
            i === 0 && "h-1.5 max-md:h-[5px]",
            i === 1 && "h-2.5 max-md:h-2",
            i === 2 && "h-3.5 max-md:h-[11px]",
            i < llenas ? "bg-uva-text" : "bg-uva-divider",
          )}
        />
      ))}
    </span>
  );
}

/**
 * Tarjeta de curso del catálogo público (dirección visual "Maqueta").
 *
 * - En celular es una fila: miniatura de 112×84 a la izquierda; título, nivel,
 *   clases y duración a la derecha.
 * - Desde 768 px es una tarjeta de cuadrícula: portada 16:9 arriba; debajo, la
 *   categoría con su ícono y el nivel, el título, el instructor y la cifra de
 *   clases y duración.
 *
 * La duración se oculta si es 0 o desconocida (`null`): nunca "0 min". Mismo
 * formato que la ficha del curso (`formatHoras`).
 *
 * `categoria`: la que se muestra en la tarjeta. El catálogo pasa la del filtro
 * activo cuando la hay; si no, la primera del curso.
 */
export function CursoTarjetaPublica({
  curso,
  categoria,
  prioritaria = false,
}: {
  curso: CursoDeCategoria;
  categoria: CategoriaChip;
  /** La primera tarjeta es el LCP del catálogo; las demás cargan diferidas. */
  prioritaria?: boolean;
}) {
  const conPortada = esPortadaReal(curso.imagenPortada);
  const nivel = NIVEL[curso.nivel];
  const clases = `${curso.totalClases} ${curso.totalClases === 1 ? "clase" : "clases"}`;
  const duracion = curso.duracionTotalSegundos ? formatHoras(curso.duracionTotalSegundos) : null;

  return (
    <Link
      href={`/cursos/${curso.slug}`}
      className="group flex h-full gap-3.5 rounded-uva-sm py-4 text-uva-text no-underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uva-accent md:flex-col md:gap-0 md:py-0"
    >
      <div
        className="relative h-21 w-28 shrink-0 overflow-hidden rounded-uva-sm bg-uva-surface-2 md:aspect-video md:h-auto md:w-full md:rounded-uva-md"
        style={conPortada ? undefined : RETICULA}
      >
        {conPortada ? (
          <Image
            src={curso.imagenPortada}
            alt=""
            fill
            sizes="(max-width: 767px) 112px, (max-width: 1023px) 46vw, 440px"
            {...(prioritaria ? ({ loading: "eager", fetchPriority: "high" } as const) : {})}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <IconoCategoria clave={categoria.nombre} grosor={5} className="size-9 md:size-14" />
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:gap-2 md:pt-3.5">
        {/* Categoría y nivel: solo en la tarjeta de cuadrícula. */}
        <span className="hidden items-center justify-between gap-3 md:flex">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-uva-detalle font-semibold text-uva-text-muted">
            <IconoCategoria clave={categoria.nombre} className="size-4" />
            <span className="truncate">{categoria.nombre}</span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-2 text-uva-detalle font-semibold text-uva-text">
            <BarrasNivel nivel={curso.nivel} />
            {nivel.etiqueta}
          </span>
        </span>

        <h2 className="line-clamp-3 text-uva-cuerpo leading-snug font-bold text-balance group-hover:text-uva-accent-ink">
          {curso.titulo}
        </h2>

        {/* Celular: nivel, clases y duración en una línea. */}
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-uva-detalle text-uva-text-muted md:hidden">
          <span className="inline-flex items-center gap-1.5">
            <BarrasNivel nivel={curso.nivel} />
            {nivel.etiqueta}
          </span>
          <span>{clases}</span>
          {duracion && <span>{duracion}</span>}
        </span>

        {/* Cuadrícula: instructor a la izquierda, clases y duración a la derecha. */}
        <span className="mt-auto hidden items-baseline justify-between gap-3 text-uva-detalle text-uva-text-muted md:flex">
          <span className="min-w-0 truncate">{curso.instructorNombre}</span>
          <span className="flex shrink-0 gap-2.5 font-mono">
            <span>{clases}</span>
            {duracion && <span>{duracion}</span>}
          </span>
        </span>
      </div>
    </Link>
  );
}
