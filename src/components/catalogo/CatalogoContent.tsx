"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CursoCard } from "@/components/catalogo/CursoCard";
import type { CategoriaDetalle } from "@/lib/categoria";

export function CatalogoContent({
  categorias,
  basePath = "/catalogo",
  volverHref = "/",
}: {
  categorias: CategoriaDetalle[];
  basePath?: string;
  volverHref?: string;
}) {
  const [filtroCategoria, setFiltroCategoria] = useState("todas");

  const categoriaItems = useMemo(
    () => ({
      todas: "Todas las categorías",
      ...Object.fromEntries(categorias.map((categoria) => [categoria.id, categoria.nombre])),
    }),
    [categorias],
  );

  const categoriasFiltradas = useMemo(
    () =>
      filtroCategoria === "todas"
        ? categorias
        : categorias.filter((categoria) => categoria.id === filtroCategoria),
    [categorias, filtroCategoria],
  );

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-10 px-[clamp(20px,3vw,44px)] py-8">
      <div>
        <Link
          href={volverHref}
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-uva-text-muted hover:text-uva-text"
        >
          <ChevronLeft className="size-4" strokeWidth={1.9} />
          Inicio
        </Link>
        <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight text-uva-text">Catálogo</h1>
        <p className="mt-1.5 max-w-[560px] text-sm text-uva-text-muted">
          Todo el catálogo del gremio: categoría y curso.
        </p>
        <div className="mt-5 flex flex-wrap gap-2.5">
          <Select
            items={categoriaItems}
            value={filtroCategoria}
            onValueChange={(value) => setFiltroCategoria(value ?? "todas")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las categorías</SelectItem>
              {categorias.map((categoria) => (
                <SelectItem key={categoria.id} value={categoria.id}>
                  {categoria.nombre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {categoriasFiltradas.length === 0 ? (
        <p className="text-sm text-uva-text-muted">Todavía no hay cursos publicados. Vuelve pronto.</p>
      ) : (
        <div className="flex flex-col gap-11">
          {categoriasFiltradas.map((categoria) => (
            <section key={categoria.id}>
              <div className="flex items-center gap-3 border-b border-uva-divider pb-3">
                <h3 className="mb-0 text-lg text-uva-text">{categoria.nombre}</h3>
                <span className="rounded-uva-xs bg-uva-badge-neutral-bg px-2.5 py-1 text-xs text-uva-badge-neutral-fg">
                  {categoria.cursos.length} {categoria.cursos.length === 1 ? "curso" : "cursos"}
                </span>
                <Link
                  href={`${basePath}/${categoria.id}`}
                  className="ml-auto text-[13px] text-uva-text hover:text-uva-accent-text"
                >
                  Ver categoría
                </Link>
              </div>
              <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
                {categoria.cursos.map((curso) => (
                  <CursoCard key={curso.id} curso={curso} categoriaNombre={categoria.nombre} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
