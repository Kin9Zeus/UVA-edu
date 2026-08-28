"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CursoCard } from "@/components/catalogo/CursoCard";
import { BuscadorInput } from "@/components/catalogo/BuscadorInput";
import { Paginacion } from "@/components/Paginacion";
import type { CategoriaActiva, CategoriaInfo, CursoOpcionBuscador, ResultadoCatalogo } from "@/lib/categoria";

// Revf3 ("Catálogo con búsqueda por palabra clave y filtro por categoría"):
// no disparar una consulta al servidor por cada tecla.
const DEBOUNCE_MS = 300;

export function CatalogoContent({
  categorias,
  resultado,
  opcionesBusqueda,
  categoriaFija,
  basePath = "/catalogo",
  volverHref = "/",
}: {
  /** Categorías activas para el selector — no se usa si categoriaFija está presente. */
  categorias: CategoriaActiva[];
  resultado: ResultadoCatalogo;
  opcionesBusqueda: CursoOpcionBuscador[];
  /** Vista de una sola categoría (/catalogo/[slug]): oculta el selector, el param `categoria` no se toca. */
  categoriaFija?: CategoriaInfo;
  basePath?: string;
  volverHref?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [texto, setTexto] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Búsqueda y filtro viven en la URL (?q=&categoria=&page=), no en estado
  // local perdido al recargar: un link compartido o el botón "atrás"
  // reproducen exactamente el mismo resultado.
  function actualizarUrl(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    // Cambiar de búsqueda o de categoría vuelve a la página 1, salvo que el
    // cambio en curso sea justo el de página.
    if (!("page" in cambios)) params.delete("page");
    startTransition(() => {
      router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
    });
  }

  function alEscribir(valor: string) {
    setTexto(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => actualizarUrl({ q: valor || undefined }), DEBOUNCE_MS);
  }

  // Seleccionar una sugerencia del dropdown filtra de inmediato, sin
  // esperar el debounce — mismo comportamiento que tenía antes.
  function alSeleccionarSugerencia(valor: string) {
    setTexto(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    actualizarUrl({ q: valor || undefined });
  }

  function limpiarFiltros() {
    setTexto("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    startTransition(() => router.push(categoriaFija ? pathname : basePath));
  }

  const categoriaSlugActual = categoriaFija?.slug ?? searchParams.get("categoria") ?? "todas";

  const categoriaItems = useMemo(
    () => ({
      todas: "Todas las categorías",
      ...Object.fromEntries(categorias.map((categoria) => [categoria.slug, categoria.nombre])),
    }),
    [categorias],
  );

  const hayFiltrosActivos = texto.trim() !== "" || categoriaSlugActual !== "todas";

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-8 px-[clamp(20px,3vw,44px)] py-8">
      <div>
        <Link
          href={categoriaFija ? basePath : volverHref}
          className="mb-3 inline-flex items-center gap-1 text-[13px] text-uva-text-muted hover:text-uva-text"
        >
          <ChevronLeft className="size-4" strokeWidth={1.9} />
          {categoriaFija ? "Catálogo" : "Inicio"}
        </Link>
        <h1 className="text-[clamp(28px,3.4vw,38px)] leading-tight text-uva-text">
          {categoriaFija ? categoriaFija.nombre : "Catálogo"}
        </h1>
        <p className="mt-1.5 max-w-[560px] text-sm text-uva-text-muted">
          {categoriaFija ? (categoriaFija.descripcion ?? "Cursos de esta categoría.") : "Todo el catálogo del gremio: categoría y curso."}
        </p>
        <p className="mt-3 text-xs text-uva-text-faint">
          {resultado.totalResultados} {resultado.totalResultados === 1 ? "curso" : "cursos"}
        </p>

        <div className="mt-5 flex flex-wrap gap-2.5">
          {!categoriaFija && (
            <Select
              items={categoriaItems}
              value={categoriaSlugActual}
              onValueChange={(value) => actualizarUrl({ categoria: value === "todas" ? undefined : (value ?? undefined) })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((categoria) => (
                  <SelectItem key={categoria.id} value={categoria.slug}>
                    {categoria.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <BuscadorInput
            placeholder="Buscar por curso o instructor"
            valorInicial={texto}
            opciones={opcionesBusqueda}
            onBuscar={alSeleccionarSugerencia}
            onTextoChange={alEscribir}
          />
        </div>
      </div>

      {resultado.cursos.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-uva-text-muted">
            {texto.trim()
              ? `No encontramos cursos para «${texto.trim()}».`
              : hayFiltrosActivos
                ? "No encontramos cursos con este filtro."
                : "Todavía no hay cursos publicados. Vuelve pronto."}
          </p>
          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="text-[13px] font-semibold text-uva-accent-text hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(232px,1fr))] gap-4">
            {resultado.cursos.map((curso) => (
              <CursoCard key={curso.id} curso={curso} />
            ))}
          </div>

          <Paginacion
            pagina={resultado.pagina}
            totalPaginas={resultado.totalPaginas}
            onCambiarPagina={(pagina) => actualizarUrl({ page: String(pagina) })}
          />
        </>
      )}
    </div>
  );
}
