"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BuscadorInput } from "@/components/catalogo/BuscadorInput";
import { CursoTarjetaPublica } from "@/components/catalogo/CursoTarjetaPublica";
import { cn } from "@/lib/utils";
import { filtroEstadoDeUrl, type FiltroEstado } from "@/lib/filtroEstado";
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

/** Botones de estado del catálogo del panel, en el orden del diseño. */
const ESTADOS: { valor: string | undefined; etiqueta: string }[] = [
  { valor: undefined, etiqueta: "Todos" },
  { valor: "sin-empezar", etiqueta: "Sin empezar" },
  { valor: "en-progreso", etiqueta: "En progreso" },
  { valor: "completados", etiqueta: "Completados" },
];

/** Qué decir cuando un filtro de estado no deja cursos (sin texto de búsqueda). */
const VACIO_POR_ESTADO: Record<FiltroEstado, string> = {
  SIN_EMPEZAR: "Ya empezaste todos los cursos de esta lista.",
  EN_PROGRESO: "No tienes cursos en progreso.",
  COMPLETADO: "Todavía no completas ningún curso.",
};

const CLASE_ENLACE_TEXTO =
  "inline-flex min-h-11 items-center text-uva-cuerpo font-semibold text-uva-accent-ink underline underline-offset-4 hover:no-underline";

/**
 * Catálogo de cursos, dirección visual "Maqueta". Un solo componente para los
 * dos contextos del canvas de diseño:
 *
 * - `publico` ("Catalogo Home"): `/catalogo` y `/catalogo/[categoria]`. Ruta
 *   "Inicio / Catálogo", botones de categoría en celular y cursos en filas.
 * - `panel` ("Catalogo sesion"): `/dashboard/catalogo` y su vista por
 *   categoría. Enlace "← Inicio" al panel, filtro por estado (Todos, Sin
 *   empezar, En progreso, Completados), tarjetas también en celular y el
 *   avance del estudiante sobre la portada.
 *
 * Búsqueda, categoría, estado y cuántos cursos se ven viven en la URL
 * (`?q=&categoria=&estado=&page=`): recargar, compartir el enlace o volver
 * atrás reproduce la misma lista. `page` es HASTA qué página se ve ("cargar
 * más"), ver `buscarCatalogoPublico` y `buscarCatalogoConProgreso`.
 */
export function CatalogoCursos({
  contexto,
  categorias,
  resultado,
  opcionesBusqueda,
  categoriaFija,
}: {
  contexto: "publico" | "panel";
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
  const panel = contexto === "panel";
  const parametroEstado = panel ? (searchParams.get("estado") ?? undefined) : undefined;
  const estadoActivo = filtroEstadoDeUrl(parametroEstado);
  const rutaCatalogo = panel ? "/dashboard/catalogo" : "/catalogo";

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

  const hayFiltros = texto.trim() !== "" || Boolean(categoriaActiva) || Boolean(estadoActivo);

  /** La categoría que muestra cada tarjeta: la del filtro si hay una, si no la primera del curso. */
  function categoriaDeTarjeta(curso: CursoDeCategoria): CategoriaChip {
    const filtro = categoriaFija ?? categoriaActiva;
    if (filtro && curso.categorias.some((c) => c.id === filtro.id)) return { id: filtro.id, nombre: filtro.nombre };
    return curso.categorias[0];
  }

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-6 px-uva-margen pt-2 pb-uva-seccion md:gap-8">
      {panel ? (
        <Link
          href={categoriaFija ? rutaCatalogo : "/dashboard"}
          className="inline-flex min-h-11 items-center gap-1 self-start text-uva-detalle text-uva-text-muted hover:text-uva-text"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-4"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {categoriaFija ? "Catálogo" : "Inicio"}
        </Link>
      ) : (
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
                  <Link href={rutaCatalogo} className="text-uva-text-muted underline underline-offset-[3px] hover:text-uva-text">
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
      )}

      <div className="flex flex-col gap-2">
        <h1 className="text-uva-titulo-3 text-balance text-uva-text">
          {categoriaFija ? categoriaFija.nombre : panel ? "Catálogo" : "Catálogo de cursos"}
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
                className={cn(
                  "min-h-11.25 gap-2.5 rounded-uva-md border-[1.5px] border-uva-line-strong bg-uva-surface px-3.5 text-uva-cuerpo font-semibold text-uva-text md:h-9 md:min-h-9 md:border md:text-uva-detalle md:font-medium dark:bg-uva-surface dark:hover:bg-uva-surface",
                  "flex max-md:w-full",
                )}
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
            inputClassName="h-11.25 border-[1.5px] border-uva-line-strong pl-11 text-base hover:border-uva-text md:h-9 md:border sm:text-base md:text-uva-detalle"
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
        </div>

        {panel && (
          <ul aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
            {ESTADOS.map(({ valor, etiqueta }) => {
              const presionado = (filtroEstadoDeUrl(valor) ?? null) === (estadoActivo ?? null);
              return (
                <li key={etiqueta}>
                  <button
                    type="button"
                    aria-pressed={presionado}
                    onClick={() => navegar(hrefCon({ estado: valor }))}
                    className={cn(
                      "inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-uva-detalle md:min-h-9 md:border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
                      presionado
                        ? "border-uva-text bg-uva-text font-bold text-uva-bg"
                        : "border-uva-line-strong font-medium text-uva-text hover:border-uva-text",
                    )}
                  >
                    {etiqueta}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Resultados
        panel={panel}
        estado={estadoActivo}
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

function Resultados({
  panel,
  estado,
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
  panel: boolean;
  estado: FiltroEstado | undefined;
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
            : estado
              ? VACIO_POR_ESTADO[estado]
              : hayFiltros
              ? "No encontramos cursos en esta categoría."
              : "Todavía no hay cursos publicados. Vuelve pronto."}
        </p>
        {hayFiltros && (
          <button type="button" onClick={onLimpiar} className={CLASE_ENLACE_TEXTO}>
            {estado && !texto.trim() ? "Ver todos los cursos" : "Limpiar filtros"}
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
          "transition-opacity motion-reduce:transition-none",
          panel
            ? "grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
            : "border-t border-uva-divider md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-8 md:border-t-0 lg:grid-cols-3",
          cargando && "opacity-60",
        )}
      >
        {resultado.cursos.map((curso, i) => (
          <li key={curso.id} className={panel ? undefined : "border-b border-uva-divider md:border-b-0"}>
            <CursoTarjetaPublica
              curso={curso}
              categoria={categoriaDeTarjeta(curso)}
              prioritaria={i === 0}
              disposicion={panel ? "tarjeta" : "fila-en-celular"}
              sobrePortada={panel && curso.progreso ? <InsigniaAvance progreso={curso.progreso} /> : undefined}
            />
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

/**
 * Avance del estudiante sobre la portada: "Completado" en amarillo de marca,
 * "Examen pendiente" (terminó las clases y le falta aprobar el examen) y "En
 * progreso" con el porcentaje y una barra al pie de la portada. Es texto del
 * enlace, así que el lector de pantalla lo anuncia con el título.
 */
function InsigniaAvance({ progreso }: { progreso: NonNullable<CursoDeCategoria["progreso"]> }) {
  const pildora = "inline-flex min-h-6 items-center gap-1.5 rounded-full px-2.5 text-uva-detalle font-bold";

  if (progreso.estado === "COMPLETADO") {
    return (
      <span className="absolute top-2.5 left-2.5">
        <span className={cn(pildora, "bg-uva-accent-2 text-uva-on-bright")}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="size-3.5"
          >
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
          Completado
        </span>
      </span>
    );
  }

  if (progreso.estado === "EXAMEN_PENDIENTE") {
    return (
      <span className="absolute top-2.5 left-2.5">
        <span className={cn(pildora, "border border-uva-line-strong bg-uva-surface text-uva-badge-warn-fg")}>
          Examen pendiente
        </span>
      </span>
    );
  }

  return (
    <>
      <span className="absolute top-2.5 left-2.5">
        <span className={cn(pildora, "bg-uva-btn text-uva-on-accent")}>
          En progreso
          <span className="font-mono">{progreso.porcentaje} %</span>
        </span>
      </span>
      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 bg-uva-overlay">
        <span className="block h-full bg-uva-btn" style={{ width: `${progreso.porcentaje}%` }} />
      </span>
    </>
  );
}
