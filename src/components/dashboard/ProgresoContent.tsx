import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import type { ProgresoData } from "@/lib/progreso";

export function ProgresoContent({ data }: { data: ProgresoData }) {
  const { clasesCompletadas, clasesTotal, certificados, cursos } = data;

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <h1 className="text-2xl text-uva-text">Tu progreso</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <p className="text-xs text-uva-text-faint">Clases completadas</p>
          <p className="mt-1 font-heading text-3xl text-uva-text">{clasesCompletadas}</p>
          <p className="text-[11.5px] text-uva-text-faint">de {clasesTotal} en tus cursos</p>
        </div>
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <p className="text-xs text-uva-text-faint">Cursos en progreso</p>
          <p className="mt-1 font-heading text-3xl text-uva-text">{cursos.length}</p>
        </div>
        <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <p className="text-xs text-uva-text-faint">Certificados</p>
          <p className="mt-1 font-heading text-3xl text-uva-text">{certificados}</p>
        </div>
      </div>

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-6">
        <h2 className="mb-4 text-base text-uva-text">Tus cursos</h2>
        {cursos.length === 0 ? (
          <p className="text-sm text-uva-text-muted">
            Todavía no has empezado ningún curso. Explora el catálogo para arrancar.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {cursos.map((curso) => (
              <Link
                key={curso.cursoId}
                href={`/cursos/${curso.cursoId}`}
                className="flex flex-col gap-2 rounded-uva-sm p-2 hover:bg-[#1c1c20]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-uva-text">{curso.titulo}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      {curso.categorias.map((categoria) => (
                        <span
                          key={categoria.id}
                          className="rounded-uva-xs bg-uva-accent-soft px-2 py-0.5 text-[10px] text-uva-accent-text"
                        >
                          {categoria.nombre}
                        </span>
                      ))}
                      {curso.porcentaje === 100 && (
                        <span className="rounded-uva-xs bg-uva-valid-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.12em] text-uva-valid uppercase">
                          Completado
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-uva-text-faint tabular-nums">
                    {curso.leccionesCompletadas}/{curso.leccionesTotal}
                  </span>
                </div>
                <Progress value={curso.porcentaje} />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
