import Link from "next/link";
import Image from "next/image";
import { getCursoDestacado } from "@/lib/cursoDestacado";
import { esPortadaReal } from "@/lib/media";
import { formatHoras } from "@/lib/admin/format";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

/**
 * Sin curso marcado `destacado` en el admin, la sección no se renderiza —
 * ver getCursoDestacado(). No hay banner de "próximamente" ni placeholder.
 */
export async function CursoDestacado() {
  const curso = await getCursoDestacado();
  if (!curso) return null;

  return (
    <section
      aria-labelledby="curso-destacado-heading"
      className="mx-auto w-full max-w-uva px-uva-margen pt-uva-seccion"
    >
      <h2
        id="curso-destacado-heading"
        className="mb-4 text-uva-titulo-4 text-uva-text lg:mb-5"
      >
        Curso destacado
      </h2>
      <article className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-[60px]">
        <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-uva-lg border border-uva-divider bg-uva-surface-2 bg-[repeating-linear-gradient(135deg,var(--uva-stripe)_0_2px,transparent_2px_9px)] lg:w-[min(560px,45%)]">
          {esPortadaReal(curso.imagenPortada) && (
            <Image
              src={curso.imagenPortada}
              alt=""
              fill
              // Es el LCP de la portada también en móvil (Lighthouse, 2026-10-08):
              // sin prioridad alta el navegador la pedía tarde.
              loading="eager"
              fetchPriority="high"
              sizes="(max-width: 1023px) 100vw, 560px"
              className="object-cover"
            />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:gap-3.5">
          <h3 className="text-uva-titulo-3 text-balance text-uva-text">
            {curso.titulo}
          </h3>
          <p className="line-clamp-3 text-uva-lead text-uva-text-muted">{curso.descripcion}</p>
          <dl className="mt-1 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-uva-detalle text-uva-text-muted">Nivel</dt>
              <dd className="mt-1 text-uva-cuerpo font-bold text-uva-text">{NIVEL_LABEL[curso.nivel]}</dd>
            </div>
            <div>
              <dt className="text-uva-detalle text-uva-text-muted">Clases</dt>
              <dd className="mt-1 font-mono text-uva-cuerpo font-bold text-uva-text">{curso.totalClases}</dd>
            </div>
            {/* Sin videos listos no hay duración real: se omite en vez de "—". */}
            {curso.duracionTotalSegundos > 0 && (
              <div>
                <dt className="text-uva-detalle text-uva-text-muted">Duración</dt>
                <dd className="mt-1 font-mono text-uva-cuerpo font-bold text-uva-text">
                  {formatHoras(curso.duracionTotalSegundos)}
                </dd>
              </div>
            )}
          </dl>
          <Link
            href={`/cursos/${curso.slug}`}
            className="inline-flex min-h-11 items-center self-start text-uva-lead font-bold text-uva-text underline decoration-uva-accent-2 decoration-[3px] underline-offset-[6px] hover:text-uva-accent-ink"
          >
            Explorar el curso
          </Link>
        </div>
      </article>
    </section>
  );
}
