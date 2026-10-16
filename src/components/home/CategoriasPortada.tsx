import Link from "next/link";
import type { CategoriaActiva } from "@/lib/categoria";
import { trazoIconoCategoria } from "@/lib/iconosCategoria";

/** Cuántas categorías caben en la portada; el resto vive en el catálogo. */
const MAXIMO_EN_PORTADA = 5;

/**
 * Lista "Explora por categoría" de la portada: las escuelas del filtro del
 * catálogo y del pie (activas, con al menos un curso publicado), las de más
 * cursos primero y como máximo MAXIMO_EN_PORTADA. Debajo, el enlace al
 * catálogo, donde están todas. Sin categorías no se renderiza: nunca un
 * título sobre una lista vacía.
 */
export function CategoriasPortada({ categorias }: { categorias: CategoriaActiva[] }) {
  if (categorias.length === 0) return null;
  const visibles = [...categorias].sort((a, b) => b.totalCursos - a.totalCursos).slice(0, MAXIMO_EN_PORTADA);

  return (
    <section
      id="categorias"
      aria-labelledby="categorias-titulo"
      className="mx-auto w-full max-w-uva px-uva-margen pt-6 pb-uva-seccion lg:pt-8"
    >
      <h2
        id="categorias-titulo"
        className="mb-7 text-uva-titulo-2 text-uva-text lg:mb-10"
      >
        Explora por categoría
      </h2>
      <ul className="border-t border-uva-divider">
        {visibles.map((categoria) => (
          <li key={categoria.id}>
            <Link
              href={`/catalogo/${categoria.slug}`}
              className="group flex min-h-22 items-center gap-4 border-b border-uva-divider px-1 py-[18px] text-uva-text no-underline hover:no-underline lg:min-h-[88px] lg:gap-6 lg:px-2 lg:py-4"
            >
              <svg
                viewBox="0 0 96 96"
                fill="none"
                strokeWidth={6}
                strokeLinejoin="round"
                aria-hidden="true"
                className="size-9 shrink-0 stroke-uva-accent-2-text lg:size-10"
              >
                <path d={trazoIconoCategoria(categoria.slug)} />
              </svg>
              <span className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-6">
                <span className="flex-1 font-heading text-uva-titulo-4 font-extrabold text-balance group-hover:text-uva-accent-2-text">
                  {categoria.nombre}
                </span>
                <span className="text-uva-cuerpo text-uva-text-muted tabular-nums">
                  {categoria.totalCursos} {categoria.totalCursos === 1 ? "curso" : "cursos"}
                </span>
              </span>
              <svg
                viewBox="0 0 10 16"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="h-4 w-2.5 shrink-0 text-uva-accent-ink"
              >
                <path d="M2 2l6 6-6 6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/catalogo"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-uva-md border-[1.5px] border-uva-line-strong px-6 text-uva-cuerpo font-semibold text-uva-text no-underline hover:border-uva-text hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent max-sm:w-full lg:mt-10"
      >
        Ver todas las categorías
      </Link>
    </section>
  );
}
