import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { CursoTarjetaPublica, BarrasNivel, NIVEL } from "@/components/catalogo/CursoTarjetaPublica";
import {
  BarraBusqueda,
  CargarMas,
  EnlaceFiltro,
  ErrorCatalogo,
  FraseResultados,
  ProveedorCatalogo,
  ZonaResultados,
} from "@/components/catalogo/FiltrosCatalogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { EsqueletoRegion, Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  hrefCatalogo,
  PARAMETRO_DE_NIVEL,
  type FiltroEstado,
  type FiltroNivel,
  type FiltrosCatalogo,
} from "@/lib/filtroEstado";
import type {
  CategoriaActiva,
  CategoriaChip,
  CategoriaInfo,
  CursoDeCategoria,
  ResultadoCatalogo,
} from "@/lib/categoria";

/** Filtro de avance del catálogo del panel, en el orden del diseño. */
const ESTADOS: { valor: FiltroEstado | undefined; etiqueta: string }[] = [
  { valor: undefined, etiqueta: "Todos" },
  { valor: "SIN_EMPEZAR", etiqueta: "Sin empezar" },
  { valor: "EN_PROGRESO", etiqueta: "En progreso" },
  { valor: "COMPLETADO", etiqueta: "Completados" },
];

/** Cómo se lee cada avance dentro de la frase de resultados. */
const ESTADO_EN_FRASE: Record<FiltroEstado, [singular: string, plural: string]> = {
  SIN_EMPEZAR: ["sin empezar", "sin empezar"],
  EN_PROGRESO: ["en progreso", "en progreso"],
  COMPLETADO: ["completado", "completados"],
};

/** Qué decir cuando solo el filtro de avance deja la lista vacía. */
const VACIO_POR_ESTADO: Record<FiltroEstado, string> = {
  SIN_EMPEZAR: "Ya empezaste todos los cursos de esta lista.",
  EN_PROGRESO: "No tienes cursos en progreso.",
  COMPLETADO: "Todavía no completas ningún curso.",
};

const ID_LISTA = "lista-cursos";

const CLASE_BOTON_FILTRO =
  "inline-flex min-h-11 items-center gap-2 rounded-full border-[1.5px] px-4 text-uva-detalle no-underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

/**
 * Catálogo de cursos. Un solo componente para los dos contextos:
 *
 * - `publico`: `/catalogo` y `/catalogo/[categoria]`. Ruta "Inicio /
 *   Catálogo" y cursos en filas en el celular.
 * - `panel`: `/dashboard/catalogo` y su vista por categoría. Enlace
 *   "‹ Inicio", filtro por avance y tarjetas con el avance del estudiante.
 *
 * Es de servidor: solo la búsqueda, los filtros y "Cargar más" corren en el
 * navegador (FiltrosCatalogo.tsx). Búsqueda, escuela, nivel, avance y cuántos
 * cursos se ven viven en la URL (`?q=&categoria=&nivel=&estado=&page=`):
 * recargar, compartir el enlace o volver atrás reproduce la misma lista.
 *
 * Filtros: escuela en un desplegable (aguanta cualquier cantidad de escuelas
 * y nombres largos). Nivel en desplegable en el celular y en botones desde
 * 768 px; el avance, siempre en botones. En el celular del panel, nivel y
 * avance van plegados en "Más filtros". Un filtro con una sola opción no se
 * muestra.
 */
export function CatalogoCursos({
  contexto,
  categorias,
  resultado,
  filtros,
  niveles,
  categoriaFija,
}: {
  contexto: "publico" | "panel";
  /** Escuelas activas para el filtro. Vacío en la vista de una escuela. */
  categorias: CategoriaActiva[];
  resultado: ResultadoCatalogo;
  /** Filtros de la URL, ya normalizados. */
  filtros: FiltrosCatalogo;
  /** Niveles con al menos un curso publicado. */
  niveles: FiltroNivel[];
  /** Vista de una sola escuela: sin filtro de escuela, ruta con su nombre. */
  categoriaFija?: CategoriaInfo;
}) {
  const panel = contexto === "panel";
  const raiz = panel ? "/dashboard/catalogo" : "/catalogo";
  const ruta = categoriaFija ? `${raiz}/${categoriaFija.slug}` : raiz;

  // Solo cuentan los filtros que la página entiende: un `?categoria=` que no
  // es una escuela activa se ignora, igual que en la consulta.
  const categoriaActiva = categoriaFija ? undefined : categorias.find((c) => c.slug === filtros.categoria);
  const actuales: FiltrosCatalogo = {
    ...filtros,
    categoria: categoriaActiva?.slug,
    nivel: niveles.length > 1 ? filtros.nivel : undefined,
    estado: panel ? filtros.estado : undefined,
  };
  const hayFiltros = Boolean(actuales.q || actuales.categoria || actuales.nivel || actuales.estado);

  const opcionesNivel = niveles.length > 1 ? niveles : [];
  const grupoNivel = (sufijo: string) =>
    opcionesNivel.length > 0 && (
      <GrupoFiltro id={`nivel-${sufijo}`} etiqueta="Nivel">
        {[undefined, ...opcionesNivel].map((nivel) => (
          <BotonFiltro
            key={nivel ?? "todos"}
            href={hrefCatalogo(ruta, actuales, { nivel })}
            activo={actuales.nivel === nivel}
          >
            {nivel && <BarrasNivel nivel={nivel} colorDelTexto />}
            {nivel ? NIVEL[nivel].etiqueta : "Todos"}
          </BotonFiltro>
        ))}
      </GrupoFiltro>
    );
  const grupoAvance = (sufijo: string) =>
    panel && (
      <GrupoFiltro id={`avance-${sufijo}`} etiqueta="Tu avance">
        {ESTADOS.map(({ valor, etiqueta }) => (
          <BotonFiltro key={etiqueta} href={hrefCatalogo(ruta, actuales, { estado: valor })} activo={actuales.estado === valor}>
            {etiqueta}
          </BotonFiltro>
        ))}
      </GrupoFiltro>
    );
  const plegados = (actuales.nivel ? 1 : 0) + (actuales.estado ? 1 : 0);

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-6 px-uva-margen pt-2 pb-uva-seccion md:gap-8">
      {panel ? (
        <Link
          href={categoriaFija ? raiz : "/dashboard"}
          className="inline-flex min-h-11 items-center gap-1 self-start text-uva-detalle text-uva-text-muted no-underline hover:text-uva-text"
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
                  <Link href={raiz} className="text-uva-text-muted underline underline-offset-[3px] hover:text-uva-text">
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
            ? (categoriaFija.descripcion ?? "Cursos de esta escuela.")
            : "Todo el catálogo del gremio, por escuela y nivel."}
        </p>
      </div>

      <ProveedorCatalogo>
        <div className="flex flex-col gap-5">
          <BarraBusqueda
            ruta={ruta}
            filtros={actuales}
            escuelas={categoriaFija ? [] : categorias}
            // En el celular público el nivel va en desplegable; en el panel, en "Más filtros".
            niveles={panel ? [] : opcionesNivel.map((n) => ({ valor: PARAMETRO_DE_NIVEL[n], etiqueta: NIVEL[n].etiqueta }))}
          />

          {(opcionesNivel.length > 0 || panel) && (
            <div className="hidden flex-wrap gap-x-10 gap-y-5 md:flex">
              {grupoNivel("ancho")}
              {grupoAvance("ancho")}
            </div>
          )}

          {panel && (
            <details className="group border-y border-uva-divider md:hidden">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-uva-cuerpo font-bold text-uva-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent [&::-webkit-details-marker]:hidden">
                <span className="inline-flex items-center gap-2">
                  Más filtros
                  {plegados > 0 && (
                    <span className="rounded-full bg-uva-btn px-2 font-mono text-uva-detalle text-uva-on-accent">
                      {plegados}
                      <span className="sr-only"> {plegados === 1 ? "activo" : "activos"}</span>
                    </span>
                  )}
                </span>
                <ChevronDownIcon aria-hidden="true" className="size-5 text-uva-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <div className="flex flex-col gap-5 pb-5">
                {grupoNivel("plegado")}
                {grupoAvance("plegado")}
              </div>
            </details>
          )}
        </div>

        <ZonaResultados>
          <Resultados
            panel={panel}
            resultado={resultado}
            filtros={actuales}
            hayFiltros={hayFiltros}
            escuela={categoriaActiva?.nombre}
            rutaSinFiltros={ruta}
            hrefMas={hrefCatalogo(ruta, actuales, { pagina: resultado.pagina + 1 })}
            categoriaDeTarjeta={(curso) => {
              // La del filtro si el curso la tiene; si no, la primera del curso.
              const filtro = categoriaFija ?? categoriaActiva;
              if (filtro && curso.categorias.some((c) => c.id === filtro.id)) return { id: filtro.id, nombre: filtro.nombre };
              return curso.categorias[0];
            }}
          />
        </ZonaResultados>
      </ProveedorCatalogo>
    </div>
  );
}

function GrupoFiltro({ id, etiqueta, children }: { id: string; etiqueta: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1.5">
      <span id={id} className="text-uva-detalle font-bold text-uva-text">
        {etiqueta}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function BotonFiltro({ href, activo, children }: { href: string; activo: boolean; children: ReactNode }) {
  return (
    <EnlaceFiltro
      href={href}
      activo={activo}
      className={cn(
        CLASE_BOTON_FILTRO,
        activo
          ? "border-uva-text bg-uva-text font-bold text-uva-bg hover:text-uva-bg"
          : "border-uva-line-strong font-medium text-uva-text hover:border-uva-text hover:text-uva-text",
      )}
    >
      {children}
    </EnlaceFiltro>
  );
}

/**
 * Los filtros leídos como frase: "3 cursos de Obra, nivel básico, en
 * progreso para «revit»", "1 curso de nivel avanzado". Es también el
 * contador que anuncia el lector de pantalla, así que dice qué cambió y no
 * solo un número.
 */
function fraseDeFiltros(total: number, filtros: FiltrosCatalogo, escuela: string | undefined) {
  const partes: string[] = [];
  if (escuela) partes.push(`de ${escuela}`);
  if (filtros.nivel) partes.push(`${escuela ? "" : "de "}nivel ${NIVEL[filtros.nivel].etiqueta.toLowerCase()}`);
  if (filtros.estado) partes.push(ESTADO_EN_FRASE[filtros.estado][total === 1 ? 0 : 1]);
  let resto = partes.length ? ` ${partes.join(", ")}` : "";
  if (filtros.q) resto += ` para «${filtros.q}»`;
  return resto;
}

function Resultados({
  panel,
  resultado,
  filtros,
  hayFiltros,
  escuela,
  rutaSinFiltros,
  hrefMas,
  categoriaDeTarjeta,
}: {
  panel: boolean;
  resultado: ResultadoCatalogo;
  filtros: FiltrosCatalogo;
  hayFiltros: boolean;
  escuela: string | undefined;
  rutaSinFiltros: string;
  hrefMas: string;
  categoriaDeTarjeta: (curso: CursoDeCategoria) => CategoriaChip;
}) {
  // AUDIT-2026-09-22.md, P2-2: un fallo nunca se muestra como "no hay cursos".
  if (resultado.fallo) return <ErrorCatalogo />;

  const total = resultado.totalResultados;
  const viendo = resultado.cursos.length;
  const resto = fraseDeFiltros(total, filtros, escuela);

  if (viendo === 0) {
    const soloAvance = filtros.estado && !filtros.q && !filtros.nivel && !escuela;
    return (
      <div className="flex flex-col gap-4">
        {/* Para el lector de pantalla: el aviso de "0 cursos" al filtrar. */}
        <FraseResultados className="sr-only">0 cursos{resto}</FraseResultados>
        {hayFiltros ? (
          <EstadoVacio
            titulo={soloAvance && filtros.estado ? VACIO_POR_ESTADO[filtros.estado] : `No encontramos cursos${resto}.`}
            texto={soloAvance ? "Mira todo el catálogo para elegir otro." : "Prueba con otra palabra o quita un filtro."}
            accion={{ etiqueta: soloAvance ? "Ver todos los cursos" : "Quitar filtros", href: rutaSinFiltros }}
          />
        ) : (
          <EstadoVacio titulo="Todavía no hay cursos publicados" texto="Estamos preparando los primeros. Vuelve pronto." />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-t border-uva-divider pt-4">
        <FraseResultados className="text-uva-titulo-4 text-balance text-uva-text">
          <span className="font-mono text-uva-accent-ink">{total}</span> {total === 1 ? "curso" : "cursos"}
          {resto}
        </FraseResultados>
        {hayFiltros && (
          <Link
            href={rutaSinFiltros}
            scroll={false}
            className="inline-flex min-h-11 items-center text-uva-cuerpo font-semibold text-uva-accent-ink underline underline-offset-4 hover:no-underline"
          >
            Quitar filtros
          </Link>
        )}
      </div>

      <ul
        id={ID_LISTA}
        className={cn(
          panel
            ? "grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3"
            : "border-t border-uva-divider md:grid md:grid-cols-2 md:gap-x-5 md:gap-y-8 md:border-t-0 lg:grid-cols-3",
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
        <div className="flex flex-col items-center gap-3 pt-2">
          <p className="font-mono text-uva-detalle text-uva-text-muted">
            Viendo {viendo} de {total} {total === 1 ? "curso" : "cursos"}
          </p>
          <div aria-hidden="true" className="h-1 w-50 bg-uva-divider">
            <div className="h-full bg-uva-text" style={{ width: `${Math.round((viendo / total) * 100)}%` }} />
          </div>
          {viendo < total && <CargarMas href={hrefMas} viendo={viendo} idLista={ID_LISTA} />}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Esqueleto del catálogo para `loading.tsx`: mismo margen, filtros y lista
 * que la página real (filas en el celular público, tarjetas en la cuadrícula),
 * para que nada salte cuando llega.
 */
export function EsqueletoCatalogo({ panel = false }: { panel?: boolean }) {
  return (
    <EsqueletoRegion
      etiqueta="Cargando el catálogo"
      className="mx-auto flex w-full max-w-uva flex-col gap-6 px-uva-margen pt-2 pb-uva-seccion md:gap-8"
    >
      <Skeleton className="h-11 w-32" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-6 w-full max-w-md" />
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:gap-3">
        <Skeleton className="h-[70px] w-full md:w-64" />
        <Skeleton className="h-[70px] w-full md:w-[420px]" />
      </div>
      <Skeleton className="h-8 w-48" />
      <div className={cn("grid gap-x-5 gap-y-8 md:grid-cols-2 lg:grid-cols-3", panel && "sm:grid-cols-2")}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={cn("flex gap-3.5 md:flex-col", panel && "flex-col")}>
            <Skeleton className={cn("aspect-video shrink-0 md:w-full", panel ? "w-full" : "h-21 w-28 md:h-auto")} />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-11/12" />
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </EsqueletoRegion>
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
