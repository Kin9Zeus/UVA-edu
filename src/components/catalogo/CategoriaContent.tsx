import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { CategoriaDetalle } from "@/lib/categoria";
import { CursoCard } from "@/components/catalogo/CursoCard";

export function CategoriaContent({
  categoria,
  basePath = "/catalogo",
}: {
  categoria: CategoriaDetalle;
  basePath?: string;
}) {
  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-[clamp(20px,3vw,44px)] py-8">
      <div>
        <Link
          href={basePath}
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-uva-text-muted hover:text-uva-text"
        >
          <ChevronLeft className="size-4" strokeWidth={1.9} />
          Catálogo
        </Link>
        <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight text-uva-text">
          {categoria.nombre}
        </h1>
        {categoria.descripcion && (
          <p className="mt-1.5 max-w-[560px] text-sm text-uva-text-muted">{categoria.descripcion}</p>
        )}
        <p className="mt-3 text-xs text-uva-text-faint">
          {categoria.cursos.length} {categoria.cursos.length === 1 ? "curso disponible" : "cursos disponibles"}
        </p>
      </div>

      {categoria.cursos.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
          {categoria.cursos.map((curso) => (
            <CursoCard key={curso.id} curso={curso} categoriaNombre={categoria.nombre} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-uva-text-muted">
          Todavía no hay cursos publicados en esta categoría. Vuelve pronto.
        </p>
      )}
    </div>
  );
}
