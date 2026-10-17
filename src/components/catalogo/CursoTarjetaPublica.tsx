import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import type { CategoriaChip, CursoDeCategoria } from "@/lib/categoria";
import { esPortadaReal } from "@/lib/media";
import { formatHoras } from "@/lib/admin/format";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import { cn } from "@/lib/utils";

export const NIVEL = {
  BASICO: { etiqueta: "Básico", barras: 1 },
  INTERMEDIO: { etiqueta: "Intermedio", barras: 2 },
  AVANZADO: { etiqueta: "Avanzado", barras: 3 },
} as const;

/** Retícula de plano para la portada de un curso sin imagen. También la usa la ficha pública del curso. */
export const RETICULA = {
  backgroundImage:
    "linear-gradient(color-mix(in srgb, var(--uva-line-strong) 25%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--uva-line-strong) 25%, transparent) 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

/** Tres barras de alto creciente; se rellenan tantas como el nivel. El texto del nivel va al lado. */
export function BarrasNivel({ nivel, className }: { nivel: CursoDeCategoria["nivel"]; className?: string }) {
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
 * Nivel del curso como se lee en las tarjetas: las tres barras y la etiqueta
 * ("Básico", "Intermedio", "Avanzado"). Va a la derecha del instructor, en su
 * misma fila. El lector de pantalla oye "Nivel Básico".
 */
export function NivelCurso({ nivel, className }: { nivel: CursoDeCategoria["nivel"]; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-2 text-uva-detalle font-semibold text-uva-text", className)}>
      <BarrasNivel nivel={nivel} />
      <span>
        <span className="sr-only">Nivel </span>
        {NIVEL[nivel].etiqueta}
      </span>
    </span>
  );
}

/**
 * Tarjeta de curso del catálogo público (dirección visual "Maqueta").
 *
 * - En celular es una fila: miniatura de 112×84 a la izquierda; a la derecha
 *   el título, el instructor con el nivel a su derecha, y clases y duración.
 * - Desde 768 px es una tarjeta de cuadrícula: portada 16:9 arriba; debajo, la
 *   categoría con su ícono y la cifra de clases y duración, el título, y el
 *   instructor con el nivel (las tres barras) a su derecha.
 *
 * La duración se oculta si es 0 o desconocida (`null`): nunca "0 min". Mismo
 * formato que la ficha del curso (`formatHoras`).
 *
 * `categoria`: la que se muestra en la tarjeta. El catálogo pasa la del filtro
 * activo cuando la hay; si no, la primera del curso.
 *
 * `disposicion="tarjeta"`: tarjeta de cuadrícula también en celular (catálogo
 * del panel). `sobrePortada`: insignias que van encima de la portada (el
 * avance del estudiante).
 */
export function CursoTarjetaPublica({
  curso,
  categoria,
  prioritaria = false,
  disposicion = "fila-en-celular",
  sobrePortada,
}: {
  curso: CursoDeCategoria;
  categoria: CategoriaChip;
  /** La primera tarjeta es el LCP del catálogo; las demás cargan diferidas. */
  prioritaria?: boolean;
  disposicion?: "fila-en-celular" | "tarjeta";
  sobrePortada?: ReactNode;
}) {
  const tarjeta = disposicion === "tarjeta";
  const conPortada = esPortadaReal(curso.imagenPortada);
  const clases = `${curso.totalClases} ${curso.totalClases === 1 ? "clase" : "clases"}`;
  const duracion = curso.duracionTotalSegundos ? formatHoras(curso.duracionTotalSegundos) : null;

  return (
    <Link
      href={`/cursos/${curso.slug}`}
      className={cn(
        "group flex h-full rounded-uva-sm text-uva-text no-underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-uva-accent",
        tarjeta ? "flex-col" : "gap-3.5 py-4 md:flex-col md:gap-0 md:py-0",
      )}
    >
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-uva-surface-2",
          tarjeta
            ? "aspect-video w-full rounded-uva-md"
            : "h-21 w-28 rounded-uva-sm md:aspect-video md:h-auto md:w-full md:rounded-uva-md",
        )}
        style={conPortada ? undefined : RETICULA}
      >
        {conPortada ? (
          <Image
            src={curso.imagenPortada}
            alt=""
            fill
            sizes={
              tarjeta
                ? "(max-width: 767px) 92vw, (max-width: 1023px) 46vw, 440px"
                : "(max-width: 767px) 112px, (max-width: 1023px) 46vw, 440px"
            }
            {...(prioritaria ? ({ loading: "eager", fetchPriority: "high" } as const) : {})}
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 grid place-items-center">
            <IconoCategoria clave={categoria.nombre} grosor={5} className={tarjeta ? "size-14" : "size-9 md:size-14"} />
          </span>
        )}
        {sobrePortada}
      </div>

      <div className={cn("flex min-w-0 flex-1 flex-col", tarjeta ? "gap-2 pt-3.5" : "gap-1.5 md:gap-2 md:pt-3.5")}>
        {/* Categoría, y clases y duración: solo en la tarjeta de cuadrícula. */}
        <span className={cn("items-center justify-between gap-3", tarjeta ? "flex" : "hidden md:flex")}>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-uva-detalle font-semibold text-uva-text-muted">
            <IconoCategoria clave={categoria.nombre} className="size-4" />
            <span className="truncate">{categoria.nombre}</span>
          </span>
          <span className="flex shrink-0 gap-2.5 font-mono text-uva-detalle text-uva-text-muted">
            <span>{clases}</span>
            {duracion && <span>{duracion}</span>}
          </span>
        </span>

        <h2 className="line-clamp-3 text-uva-cuerpo leading-snug font-bold text-balance group-hover:text-uva-accent-ink">
          {curso.titulo}
        </h2>

        {/* Instructor a la izquierda y nivel a la derecha, en la misma fila. */}
        {/* En la cuadrícula va al fondo (`mt-auto`): las tarjetas de una fila
            quedan alineadas aunque los títulos tengan distinto largo. */}
        <span
          className={cn(
            "flex items-center justify-between gap-3 text-uva-detalle text-uva-text-muted",
            tarjeta ? "mt-auto" : "md:mt-auto",
          )}
        >
          <span className="min-w-0 truncate">{curso.instructorNombre}</span>
          <NivelCurso nivel={curso.nivel} />
        </span>

        {/* Fila de celular: clases y duración (en la cuadrícula van arriba). */}
        {!tarjeta && (
          <span className="flex flex-wrap gap-x-2.5 font-mono text-uva-detalle text-uva-text-muted md:hidden">
            <span>{clases}</span>
            {duracion && <span>{duracion}</span>}
          </span>
        )}
      </div>
    </Link>
  );
}
