"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDownIcon } from "lucide-react";
import { SearchIcon, CrossIcon } from "@/components/home/icons";
import { CLASE_CAMPO_BUSCADOR, CLASE_ICONO_BUSCADOR } from "@/components/catalogo/campoBuscador";
import { AvisoErrorCarga } from "@/components/errores/AvisoErrorCarga";
import { LARGO_MAXIMO_BUSQUEDA } from "@/lib/parametros-url";
import {
  filtroNivelDeUrl,
  hrefCatalogo,
  PARAMETRO_DE_ESTADO,
  PARAMETRO_DE_NIVEL,
  type FiltrosCatalogo,
} from "@/lib/filtroEstado";
import { cn } from "@/lib/utils";

/**
 * Las únicas piezas del catálogo que corren en el navegador. La lista, las
 * tarjetas y los textos se dibujan en el servidor (CatalogoCursos.tsx): la
 * auditoría midió 3,7 s de JavaScript cuando todo el catálogo era de cliente.
 *
 * Todo cambio de filtro es una navegación a la URL nueva dentro de una
 * transición: el botón Atrás funciona, el enlace se comparte, y mientras
 * llega la lista nueva la anterior se atenúa ("Buscando…").
 */

// No disparar una consulta al servidor por cada tecla.
const DEBOUNCE_MS = 300;

const Contexto = createContext<{ pendiente: boolean; navegar: (href: string) => void }>({
  pendiente: false,
  navegar: () => {},
});

export function ProveedorCatalogo({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const navegar = (href: string) => startTransition(() => router.push(href, { scroll: false }));
  return <Contexto value={{ pendiente, navegar }}>{children}</Contexto>;
}

const CLASE_SELECT =
  "h-11 w-full min-w-0 cursor-pointer appearance-none truncate rounded-uva-md border border-uva-line-strong bg-uva-surface pr-10 pl-3.5 text-base font-semibold text-uva-text hover:border-uva-text-faint focus-visible:border-uva-accent focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-uva-accent";

const CLASE_ETIQUETA = "text-uva-detalle font-bold text-uva-text";

type Opcion = { valor: string; etiqueta: string };

/** `<select>` nativo con etiqueta visible: teclado, lector de pantalla y la lista del sistema en el celular. */
function Desplegable({
  id,
  etiqueta,
  nombre,
  valor,
  opciones,
  alCambiar,
  className,
}: {
  id: string;
  etiqueta: string;
  nombre: string;
  valor: string;
  opciones: Opcion[];
  alCambiar: (valor: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={CLASE_ETIQUETA}>
        {etiqueta}
      </label>
      <div className="relative">
        <select
          id={id}
          name={nombre}
          value={valor}
          onChange={(evento) => alCambiar(evento.target.value)}
          className={CLASE_SELECT}
        >
          {opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-uva-text-muted"
        />
      </div>
    </div>
  );
}

/**
 * Escuela, búsqueda y (solo en celular) nivel, dentro de un `<form>` GET: sin
 * JavaScript, Enter en el buscador envía todo y la página filtra igual.
 */
export function BarraBusqueda({
  ruta,
  filtros,
  escuelas,
  niveles,
}: {
  ruta: string;
  filtros: FiltrosCatalogo;
  /** Escuelas para el desplegable; vacío = sin desplegable. */
  escuelas: { slug: string; nombre: string }[];
  /** Niveles para el desplegable de celular; vacío = sin desplegable. */
  niveles: Opcion[];
}) {
  const { navegar } = useContext(Contexto);
  const q = filtros.q ?? "";
  const [texto, setTexto] = useState(q);
  const [qAnterior, setQAnterior] = useState(q);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // La URL cambió por otro lado ("Quitar filtros", Atrás): el campo la sigue.
  // Mientras se escribe, la URL alcanza al texto y no hay nada que corregir.
  if (q !== qAnterior) {
    setQAnterior(q);
    if (q !== texto.trim()) setTexto(q);
  }

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  function buscar(valor: string, espera: number) {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => navegar(hrefCatalogo(ruta, filtros, { q: valor.trim() || undefined })), espera);
  }

  // Escuela y buscador lado a lado desde 768 px, repartiendo el ancho: en el
  // panel a 768 px la barra lateral deja ~480 px y aun así cabe "Todas las
  // escuelas" sin cortarse.
  return (
    <form
      role="search"
      action={ruta}
      method="get"
      onSubmit={(evento) => {
        evento.preventDefault();
        buscar(texto, 0);
      }}
      className="flex flex-col gap-4 md:flex-row md:items-end md:gap-3"
    >
      {escuelas.length > 1 && (
        <Desplegable
          id="filtro-escuela"
          etiqueta="Escuela"
          nombre="categoria"
          valor={filtros.categoria ?? ""}
          opciones={[{ valor: "", etiqueta: "Todas las escuelas" }, ...escuelas.map((e) => ({ valor: e.slug, etiqueta: e.nombre }))]}
          alCambiar={(valor) => navegar(hrefCatalogo(ruta, filtros, { categoria: valor || undefined }))}
          className="md:max-w-64 md:flex-1"
        />
      )}

      <div className="flex min-w-0 flex-col gap-1.5 md:max-w-[420px] md:flex-1">
        <label htmlFor="buscar-cursos" className={CLASE_ETIQUETA}>
          Buscar cursos
        </label>
        <div className="relative">
          <span className={CLASE_ICONO_BUSCADOR}>
            <SearchIcon />
          </span>
          <input
            id="buscar-cursos"
            type="search"
            name="q"
            value={texto}
            onChange={(evento) => {
              setTexto(evento.target.value);
              buscar(evento.target.value, DEBOUNCE_MS);
            }}
            placeholder="Curso o instructor"
            autoComplete="off"
            enterKeyHint="search"
            // Mismo tope que aplica el servidor (lib/parametros-url.ts).
            maxLength={LARGO_MAXIMO_BUSQUEDA}
            className={cn(
              CLASE_CAMPO_BUSCADOR,
              "h-11 pl-10 text-base sm:text-base [&::-webkit-search-cancel-button]:appearance-none",
              texto && "pr-11",
            )}
          />
          {texto && (
            <button
              type="button"
              onClick={() => {
                setTexto("");
                buscar("", 0);
              }}
              aria-label="Borrar búsqueda"
              className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-uva-md text-uva-text-faint hover:text-uva-text focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-uva-accent"
            >
              <CrossIcon className="size-3" />
            </button>
          )}
        </div>
      </div>

      {niveles.length > 1 && (
        <Desplegable
          id="filtro-nivel"
          etiqueta="Nivel"
          nombre="nivel"
          valor={filtros.nivel ? PARAMETRO_DE_NIVEL[filtros.nivel] : ""}
          opciones={[{ valor: "", etiqueta: "Todos los niveles" }, ...niveles]}
          alCambiar={(valor) => navegar(hrefCatalogo(ruta, filtros, { nivel: filtroNivelDeUrl(valor) }))}
          className="md:hidden"
        />
      )}

      {/* Sin JavaScript, el envío del formulario conserva el filtro de estado. */}
      {filtros.estado && <input type="hidden" name="estado" value={PARAMETRO_DE_ESTADO[filtros.estado]} />}
    </form>
  );
}

/** Enlace de filtro (nivel, avance): navega dentro de la transición para que la lista muestre "Buscando…". */
export function EnlaceFiltro({
  href,
  activo,
  className,
  children,
}: {
  href: string;
  activo: boolean;
  className?: string;
  children: ReactNode;
}) {
  const { navegar } = useContext(Contexto);
  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      aria-current={activo ? "true" : undefined}
      onClick={(evento) => {
        if (evento.metaKey || evento.ctrlKey || evento.shiftKey || evento.altKey) return;
        evento.preventDefault();
        navegar(href);
      }}
      className={className}
    >
      {children}
    </Link>
  );
}

/** La frase de resultados, que el lector de pantalla anuncia al cambiar. */
export function FraseResultados({ className, children }: { className?: string; children: ReactNode }) {
  const { pendiente } = useContext(Contexto);
  return (
    <p aria-live="polite" className={className}>
      {pendiente ? <span className="text-uva-text-muted">Buscando…</span> : children}
    </p>
  );
}

/** Envuelve la lista: atenuada y `aria-busy` mientras llega la nueva. */
export function ZonaResultados({ children }: { children: ReactNode }) {
  const { pendiente } = useContext(Contexto);
  return (
    <div
      aria-busy={pendiente}
      className={cn("transition-opacity motion-reduce:transition-none", pendiente && "opacity-60")}
    >
      {children}
    </div>
  );
}

/**
 * "Cargar más": enlace real (`?page=N+1`) que funciona sin JavaScript y que
 * sigue un buscador; con JavaScript suma tarjetas sin moverse, y al llegar
 * pasa el foco a la primera nueva para que el teclado y el lector de pantalla
 * sigan donde iban.
 */
export function CargarMas({ href, viendo, idLista }: { href: string; viendo: number; idLista: string }) {
  const { pendiente, navegar } = useContext(Contexto);
  const enfocarDesde = useRef<number | null>(null);

  useEffect(() => {
    const desde = enfocarDesde.current;
    if (desde === null || viendo <= desde) return;
    enfocarDesde.current = null;
    document.querySelectorAll<HTMLAnchorElement>(`#${idLista} > li a`)[desde]?.focus();
  }, [viendo, idLista]);

  return (
    <Link
      href={href}
      scroll={false}
      prefetch={false}
      aria-disabled={pendiente}
      onClick={(evento) => {
        evento.preventDefault();
        if (pendiente) return;
        enfocarDesde.current = viendo;
        navegar(href);
      }}
      className="inline-flex min-h-13 w-full items-center justify-center rounded-uva-md border-[1.5px] border-uva-line-strong px-6 text-uva-cuerpo font-semibold text-uva-text no-underline hover:border-uva-text hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent aria-disabled:opacity-60 md:min-h-12 md:w-auto"
    >
      {pendiente ? "Cargando cursos…" : "Cargar más cursos"}
    </Link>
  );
}

/** Fallo al cargar el catálogo: nunca una lista vacía (AUDIT-2026-09-22.md, P2-2). */
export function ErrorCatalogo() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <AvisoErrorCarga
      texto="No pudimos cargar el catálogo. Revisa tu conexión e intenta de nuevo."
      onReintentar={() => startTransition(() => router.refresh())}
    />
  );
}
