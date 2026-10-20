"use client";

import { createContext, useContext, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

/**
 * Medidas de los controles: 44 px en pantallas táctiles (celular, tablet) y
 * bajo 640 px; 36 px con mouse, donde no hace falta el área de un dedo. La
 * letra baja a 14 px solo con mouse: en el iPhone, un campo de menos de 16 px
 * hace zoom al tocarlo.
 */
export const CLASE_TAMANO_CONTROL = "h-11 text-base sm:pointer-fine:h-9 sm:pointer-fine:text-uva-detalle";

const CLASE_ETIQUETA = "text-uva-detalle font-bold text-uva-text";

/** Valor de la opción "Todas"/"Todos": Base UI no admite "" como valor. */
const TODAS = "todas";

type Opcion = { valor: string; etiqueta: string };

/**
 * Desplegable del sistema de diseño (Base UI) con etiqueta visible: la lista
 * se ve igual en todos los celulares y navegadores. `name` deja un campo
 * oculto para que el formulario GET funcione también sin JavaScript.
 */
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
  /** "" = la primera opción ("Todas las escuelas", "Todos los niveles"). */
  valor: string;
  opciones: Opcion[];
  alCambiar: (valor: string) => void;
  className?: string;
}) {
  const valorDe = (v: string) => v || TODAS;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className={CLASE_ETIQUETA}>
        {etiqueta}
      </label>
      <Select
        name={nombre}
        items={Object.fromEntries(opciones.map((o) => [valorDe(o.valor), o.etiqueta]))}
        value={valorDe(valor)}
        onValueChange={(nuevo) => alCambiar(nuevo && nuevo !== TODAS ? String(nuevo) : "")}
      >
        <SelectTrigger
          id={id}
          className={cn(
            CLASE_TAMANO_CONTROL,
            "w-full min-w-0 pr-3 pl-3.5 font-semibold sm:pointer-fine:font-medium",
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={valorDe(o.valor)}>
              {o.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
              CLASE_TAMANO_CONTROL,
              // Anula el `sm:text-sm` del campo del encabezado: en una tablet táctil
              // también hace falta 16 px.
              "pl-10 sm:text-base [&::-webkit-search-cancel-button]:appearance-none",
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

      {/* Los desplegables dejan campos de texto ocultos (`name`) y, con más de
          un campo de texto, Enter solo envía el formulario si hay un botón de
          envío. Invisible: el buscador ya filtra mientras se escribe. */}
      <button type="submit" tabIndex={-1} aria-hidden="true" className="sr-only">
        Buscar
      </button>

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
