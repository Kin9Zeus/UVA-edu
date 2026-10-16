"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BuscadorInput } from "@/components/catalogo/BuscadorInput";
import { CursoTarjetaPublica } from "@/components/catalogo/CursoTarjetaPublica";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import { cn } from "@/lib/utils";
import type {
  CategoriaActiva,
  CategoriaChip,
  CategoriaInfo,
  CursoDeCategoria,
  CursoOpcionBuscador,
  ResultadoCatalogo,
} from "@/lib/categoria";

// Revf3: no disparar una consulta al servidor por cada tecla.
const DEBOUNCE_MS = 300;

/** Botones de categoría visibles en celular antes de "Ver las N categorías". */
const CATEGORIAS_VISIBLES = 6;

const CLASE_ENLACE_TEXTO =
  "inline-flex min-h-11 items-center text-uva-cuerpo font-semibold text-uva-accent-ink underline underline-offset-4 hover:no-underline";

/**
 * Catálogo público (`/catalogo` y `/catalogo/[categoria]`), dirección visual
 * "Maqueta" (artboard "Catalogo Home" del canvas de diseño).
 *
 * El catálogo del panel del estudiante sigue usando `CatalogoContent`: este
 * componente no lo reemplaza.
 *
 * Búsqueda, categoría y cuántos cursos se ven viven en la URL
 * (`?q=&categoria=&page=`): recargar, compartir el enlace o volver atrás
 * reproduce la misma lista. `page` es HASTA qué página se ve ("cargar más"),
 * ver `buscarCatalogoPublico`.
 */
export function CatalogoPublico({
  categorias,
  resultado,
  opcionesBusqueda,
  categoriaFija,
}: {
  /** Categorías activas para el filtro. Vacío en la vista de una categoría. */
  categorias: CategoriaActiva[];
  resultado: ResultadoCatalogo;
  opcionesBusqueda: CursoOpcionBuscador[];
  /** Vista de una sola categoría: sin filtro de categoría, ruta con su nombre. */
  categoriaFija?: CategoriaInfo;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [cargando, startTransition] = useTransition();

  const [texto, setTexto] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const slugActivo = categoriaFija ? null : searchParams.get("categoria");
  const categoriaActiva = slugActivo ? categorias.find((c) => c.slug === slugActivo) : undefined;

  function hrefCon(cambios: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    // Cambiar de búsqueda o de categoría vuelve a los primeros cursos.
    if (!("page" in cambios)) params.delete("page");
    return params.size > 0 ? `${pathname}?${params.toString()}` : pathname;
  }

  function navegar(href: string) {
    startTransition(() => router.push(href, { scroll: false }));
  }

  function alEscribir(valor: string) {
    setTexto(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navegar(hrefCon({ q: valor.trim() || undefined })), DEBOUNCE_MS);
  }

  // Elegir una sugerencia filtra de inmediato, sin esperar el debounce.
  function alSeleccionarSugerencia(valor: string) {
    setTexto(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navegar(hrefCon({ q: valor.trim() || undefined }));
  }

  function elegirCategoria(slug: string | undefined) {
    navegar(hrefCon({ categoria: slug }));
  }

  function limpiarFiltros() {
    setTexto("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navegar(pathname);
  }

  const hayFiltros = texto.trim() !== "" || Boolean(categoriaActiva);

  /** La categoría que muestra cada tarjeta: la del filtro si hay una, si no la primera del curso. */
  function categoriaDeTarjeta(curso: CursoDeCategoria): CategoriaChip {
    const filtro = categoriaFija ?? categoriaActiva;
    if (filtro && curso.categorias.some((c) => c.id === filtro.id)) return { id: filtro.id, nombre: filtro.nombre };
    return curso.categorias[0];
  }

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-6 px-uva-margen pt-2 pb-uva-seccion md:gap-8">
      <nav aria-label="Ruta" className="text-uva-detalle text-uva-text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="text-uva-text-muted underline underline-offset-[3px] hover:text-uva-text">
              Inicio
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          {categoriaFija ? (
            <>
              <li>
                <Link href="/catalogo" className="text-uva-text-muted underline underline-offset-[3px] hover:text-uva-text">
                  Catálogo
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="text-uva-text">
                {categoriaFija.nombre}
              </li>
            </>
          ) : (
            <li aria-current="page" className="text-uva-text">
              Catálogo
            </li>
          )}
        </ol>
      </nav>

      <div className="flex flex-col gap-2">
        <h1 className="text-uva-titulo-3 text-balance text-uva-text">
          {categoriaFija ? categoriaFija.nombre : "Catálogo de cursos"}
        </h1>
        <p className="max-w-[60ch] text-uva-lead text-uva-text-muted">
          {categoriaFija
            ? (categoriaFija.descripcion ?? "Cursos de esta categoría.")
            : "Todo el catálogo del gremio, por categoría y curso."}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          {categorias.length > 0 && (
            <Select
              items={{
                todas: "Todas las categorías",
                ...Object.fromEntries(categorias.map((c) => [c.slug, c.nombre])),
              }}
              value={categoriaActiva?.slug ?? "todas"}
              onValueChange={(valor) => elegirCategoria(valor && valor !== "todas" ? valor : undefined)}
            >
              <SelectTrigger
                aria-label="Filtrar por categoría"
                className="hidden min-h-11 gap-2.5 rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface px-3.5 text-uva-cuerpo font-semibold text-uva-text md:flex dark:bg-uva-surface dark:hover:bg-uva-surface"
              >
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas las categorías</SelectItem>
                {categorias.map((c) => (
                  <SelectItem key={c.id} value={c.slug}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <BuscadorInput
            placeholder="Busca un curso o instructor"
            etiqueta="Buscar por curso o instructor"
            valorInicial={texto}
            opciones={opcionesBusqueda}
            onBuscar={alSeleccionarSugerencia}
            onTextoChange={alEscribir}
            className="w-full md:w-[340px]"
            inputClassName="h-13 border-[1.5px] border-uva-line-strong pl-11 text-base hover:border-uva-text md:h-11 sm:text-base"
          />
          {/* Con `fallo` el total no es 0: es desconocido. */}
          {!resultado.fallo && (
            <p
              className="font-mono text-uva-detalle font-bold text-uva-text max-md:order-last max-md:mt-2 max-md:w-full md:ml-auto md:font-normal md:text-uva-text-muted"
              aria-live="polite"
            >
              {resultado.totalResultados} {resultado.totalResultados === 1 ? "curso" : "cursos"}
            </p>
          )}
          {/* En celular las categorías van entre el buscador y el total, que
              queda justo encima de la lista (`order-last`). */}
          {categorias.length > 0 && (
            <CategoriasMovil categorias={categorias} activa={categoriaActiva?.slug} onElegir={elegirCategoria} />
          )}
        </div>
      </div>

      <Resultados
        resultado={resultado}
        texto={texto}
        hayFiltros={hayFiltros}
        cargando={cargando}
        categoriaDeTarjeta={categoriaDeTarjeta}
        hrefMas={hrefCon({ page: String(resultado.pagina + 1) })}
        onCargarMas={navegar}
        onReintentar={() => startTransition(() => router.refresh())}
        onLimpiar={limpiarFiltros}
      />
    </div>
  );
}

/**
 * Botones de categoría en dos columnas, solo en celular (desde 768 px filtra
 * el selector). Muestran las primeras CATEGORIAS_VISIBLES y el resto detrás
 * de "Ver las N categorías"; si la activa está entre las ocultas, se abren
 * todas para que se vea cuál filtra.
 */
function CategoriasMovil({
  categorias,
  activa,
  onElegir,
}: {
  categorias: CategoriaActiva[];
  activa: string | undefined;
  onElegir: (slug: string | undefined) => void;
}) {
  const indiceActiva = categorias.findIndex((c) => c.slug === activa);
  const [abiertas, setAbiertas] = useState(indiceActiva >= CATEGORIAS_VISIBLES);
  const visibles = abiertas ? categorias : categorias.slice(0, CATEGORIAS_VISIBLES);
  const ocultas = categorias.length - CATEGORIAS_VISIBLES;

  return (
    <div className="w-full md:hidden">
      <ul id="categorias-catalogo" aria-label="Categorías" className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
        {visibles.map((categoria) => {
          const presionada = categoria.slug === activa;
          return (
            <li key={categoria.id}>
              <button
                type="button"
                aria-pressed={presionada}
                onClick={() => onElegir(presionada ? undefined : categoria.slug)}
                className={cn(
                  "flex min-h-13 w-full items-center gap-1.5 rounded-uva-md border-[1.5px] px-2.5 py-1.5 text-left text-uva-detalle font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
                  presionada
                    ? "border-uva-text bg-uva-text text-uva-bg"
                    : "border-uva-line-strong bg-transparent text-uva-text",
                )}
              >
                <IconoCategoria
                  clave={categoria.slug}
                  className={cn("size-5", presionada && "stroke-uva-bg")}
                />
                {/* Dos columnas solo si caben 9,5 rem por botón (375 px sí, 320 px
                    no, ni con la letra agrandada). Si aun así una palabra no
                    cabe, se parte en vez de montarse sobre el contador. */}
                <span className="min-w-0 flex-1 hyphens-auto [overflow-wrap:anywhere]">{categoria.nombre}</span>
                <span className="shrink-0 font-mono opacity-70">
                  <span className="sr-only">, </span>
                  {categoria.totalCursos}
                  <span className="sr-only">{categoria.totalCursos === 1 ? " curso" : " cursos"}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {ocultas > 0 && (
        <button
          type="button"
          aria-expanded={abiertas}
          aria-controls="categorias-catalogo"
          onClick={() => setAbiertas((valor) => !valor)}
          className="mt-1.5 inline-flex min-h-11 items-center px-0.5 text-uva-cuerpo font-semibold text-uva-text underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        >
          {abiertas ? "Ver menos categorías" : `Ver las ${categorias.length} categorías`}
        </button>
      )}
    </div>
  );
}

function Resultados({
  resultado,
  texto,
  hayFiltros,
  cargando,
  categoriaDeTarjeta,
  hrefMas,
  onCargarMas,
  onReintentar,
  onLimpiar,
}: {
  resultado: ResultadoCatalogo;
  texto: string;
  hayFiltros: boolean;
  cargando: boolean;
  categoriaDeTarjeta: (curso: CursoDeCategoria) => CategoriaChip;
  hrefMas: string;
  onCargarMas: (href: string) => void;
  onReintentar: () => void;
  onLimpiar: () => void;
}) {
  const listaRef = useRef<HTMLUListElement>(null);
  // Cuántas tarjetas había al pulsar "Cargar más": al llegar las nuevas, el
  // foco pasa a la primera de ellas para que el teclado y el lector de
  // pantalla sigan donde iban, en vez de quedarse en un botón que se movió.
  const enfocarDesde = useRef<number | null>(null);

  useEffect(() => {
    const desde = enfocarDesde.current;
    if (desde === null || resultado.cursos.length <= desde) return;
    enfocarDesde.current = null;
    listaRef.current?.querySelectorAll<HTMLAnchorElement>(":scope > li > a")[desde]?.focus();
  }, [resultado.cursos.length]);

  if (resultado.fallo) {
    // AUDIT-2026-09-22.md, P2-2: un fallo nunca se muestra como "no hay cursos".
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-uva-cuerpo text-uva-text-muted">No pudimos cargar el catálogo. Intenta de nuevo en un momento.</p>
        <button type="button" onClick={onReintentar} className={CLASE_ENLACE_TEXTO}>
          Reintentar
        </button>
      </div>
    );
  }

  if (resultado.cursos.length === 0) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-uva-cuerpo text-uva-text-muted">
          {texto.trim()
            ? `No encontramos cursos para «${texto.trim()}».`
            : hayFiltros
              ? "No encontramos cursos en esta categoría."
              : "Todavía no hay cursos publicados. Vuelve pronto."}
        </p>
        {hayFiltros && (
          <button type="button" onClick={onLimpiar} className={CLASE_ENLACE_TEXTO}>
            Limpiar filtros
          </button>
        )}
      </div>
    );
  }

  const viendo = resultado.cursos.length;
  const total = resultado.totalResultados;
  const hayMas = viendo < total;

  return (
    <div className="flex flex-col gap-8">
      <ul
        ref={listaRef}
        aria-busy={cargando}
        className={cn(
          "border-t border-uva-divider transition-opacity motion-reduce:transition-none md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-8 md:border-t-0 lg:grid-cols-3",
          cargando && "opacity-60",
        )}
      >
        {resultado.cursos.map((curso, i) => (
          <li key={curso.id} className="border-b border-uva-divider md:border-b-0">
            <CursoTarjetaPublica curso={curso} categoria={categoriaDeTarjeta(curso)} prioritaria={i === 0} />
          </li>
        ))}
      </ul>

      {total > viendo || resultado.pagina > 1 ? (
        <div className="flex flex-col items-center gap-3">
          <p className="font-mono text-uva-detalle text-uva-text-muted">
            Viendo {viendo} de {total} {total === 1 ? "curso" : "cursos"}
          </p>
          <div aria-hidden="true" className="h-1 w-50 bg-uva-divider">
            <div className="h-full bg-uva-text" style={{ width: `${Math.round((viendo / total) * 100)}%` }} />
          </div>
          {hayMas && (
            // Enlace real (`?page=N+1`): funciona sin JavaScript y lo sigue un
            // buscador; con JavaScript se queda en el sitio y suma tarjetas.
            <Link
              href={hrefMas}
              scroll={false}
              prefetch={false}
              aria-disabled={cargando}
              onClick={(evento) => {
                evento.preventDefault();
                if (cargando) return;
                enfocarDesde.current = viendo;
                onCargarMas(hrefMas);
              }}
              className="inline-flex min-h-13 w-full items-center justify-center rounded-uva-md border-[1.5px] border-uva-line-strong px-6 text-uva-cuerpo font-semibold text-uva-text no-underline hover:border-uva-text hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent aria-disabled:opacity-60 md:min-h-12 md:w-auto"
            >
              {cargando ? "Cargando cursos…" : "Cargar más cursos"}
            </Link>
          )}
        </div>
      ) : null}
    </div>
  );
}
