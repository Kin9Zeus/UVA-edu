import type { ReactNode } from "react";
import Link from "next/link";
import { LogoUva } from "@/components/home/LogoUva";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccionPrimaria =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type Cajetin = {
  /** Datos de la pantalla: "Error 404", "Ruta /cursos/x", "Referencia 3f9a1c2e". */
  /** `texto`: el valor es una frase ("Esperando conexión…"), no un código: va en la letra de lectura. */
  celdas: { etiqueta: string; valor: ReactNode; texto?: boolean }[];
  /** Fila de abajo con una pregunta y a dónde escribir. */
  pie?: { pregunta: string; enlace: { label: string; href: string; externo?: boolean } };
  /** El valor cambia solo (sin conexión → "Esperando conexión…"): lo anuncia el lector de pantalla. */
  enVivo?: boolean;
};

type ErrorBlockProps = {
  /** En rutas sin layout propio (pantalla completa, con el logo arriba); dentro del panel o de admin, no. */
  standalone?: boolean;
  /** "404", "500"… Sin código (sin conexión) va el `icono`. */
  codigo?: string;
  /** 500 usa el código en gris: el número no es la noticia. */
  codigoMuted?: boolean;
  /** 404 usa un punto magenta; 403, una raya. */
  indicador?: "punto" | "raya";
  icono?: ReactNode;
  titulo: string;
  texto: string;
  accionPrimaria: AccionPrimaria;
  accionSecundaria?: { label: string; href: string };
  cajetin: Cajetin;
};

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";
const BOTON = "min-h-12 text-uva-cuerpo sm:w-auto sm:px-6";

/**
 * Bloque de las pantallas de error (404, 403, 500 y sin conexión), con los
 * tokens de letra del sistema (CLAUDE.md 3.3): ningún texto de lectura baja
 * de 16 px y los dos botones miden 48 px.
 *
 * Abajo va el cajetín, como el rótulo de una lámina: datos reales de la
 * pantalla (la ruta pedida, la referencia del error) que el usuario puede
 * dictarle a soporte.
 *
 * Dentro del panel y de admin se pinta en un `<div>`: el layout ya tiene su
 * `<main id="contenido">` y uno anidado repetía el id.
 */
export function ErrorBlock({
  standalone,
  codigo,
  codigoMuted,
  indicador,
  icono,
  titulo,
  texto,
  accionPrimaria,
  accionSecundaria,
  cajetin,
}: ErrorBlockProps) {
  const bloque = (
    <div className="relative isolate flex flex-1 items-center justify-center px-uva-margen py-[clamp(40px,8vh,88px)]">
      <div aria-hidden="true" className="uva-reticula pointer-events-none absolute inset-0 -z-10" />
      <div className="flex w-full max-w-[560px] flex-col items-start gap-4">
        {codigo ? (
          <div className="flex items-baseline gap-3">
            <span className={cn("text-uva-display", codigoMuted ? "text-uva-muted-2" : "text-uva-text")}>
              {codigo}
            </span>
            {indicador === "punto" && <span aria-hidden="true" className="size-3 rounded-full bg-uva-accent" />}
            {indicador === "raya" && <span aria-hidden="true" className="mb-2 h-0.5 w-9 bg-uva-accent" />}
          </div>
        ) : (
          icono && (
            <span
              aria-hidden="true"
              className="grid size-14 place-items-center rounded-uva-lg border-[1.5px] border-uva-line-strong text-uva-text [&_svg]:size-7"
            >
              {icono}
            </span>
          )
        )}

        <div className="grid gap-2">
          <h1 className="text-uva-titulo-3 text-balance text-uva-text">{titulo}</h1>
          <p className="text-uva-lead text-pretty text-uva-text-muted">{texto}</p>
        </div>

        <div className="mt-1 flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap">
          {accionPrimaria.href ? (
            <Link
              href={accionPrimaria.href}
              className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), BOTON)}
            >
              {accionPrimaria.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={accionPrimaria.onClick}
              className={cn(buttonVariants({ variant: "uva-primary", size: "uva" }), BOTON)}
            >
              {accionPrimaria.label}
            </button>
          )}
          {accionSecundaria && (
            <Link
              href={accionSecundaria.href}
              className={cn(buttonVariants({ variant: "uva-secondary", size: "uva" }), BOTON)}
            >
              {accionSecundaria.label}
            </Link>
          )}
        </div>

        <CajetinError {...cajetin} />
      </div>
    </div>
  );

  if (!standalone) return <div className="flex min-h-full flex-col">{bloque}</div>;

  return (
    <div className="flex min-h-dvh flex-col bg-uva-bg text-uva-text">
      <header className="border-b border-uva-divider">
        <div className="mx-auto max-w-uva px-uva-margen py-2.5">
          <Link
            href="/"
            aria-label="U.V.A., ir al inicio"
            className={cn("inline-flex min-h-11 items-center rounded-uva-xs text-uva-text", FOCO)}
          >
            <LogoUva className="h-7 w-[86px]" />
          </Link>
        </div>
      </header>
      <main id="contenido" tabIndex={-1} className="flex flex-1 flex-col">
        {bloque}
      </main>
    </div>
  );
}

function CajetinError({ celdas, pie, enVivo }: Cajetin) {
  return (
    <div
      role={enVivo ? "status" : undefined}
      className={cn(
        "mt-2 grid w-full rounded-uva-xs border-[1.5px] border-uva-line-strong bg-uva-surface",
        celdas.length > 1 ? "grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]" : "grid-cols-1",
      )}
    >
      {celdas.map(({ etiqueta, valor, texto }) => (
        <div key={etiqueta} className="min-w-0 border-l border-uva-line-strong px-3 py-2.5 first:border-l-0">
          <p className="text-uva-detalle text-uva-text-muted">{etiqueta}</p>
          <p className={cn("text-uva-cuerpo font-medium text-uva-text", texto ? "" : "font-codigo break-all")}>{valor}</p>
        </div>
      ))}
      {pie && (
        <div className="col-span-full border-t border-uva-line-strong px-3 pt-2.5 pb-1">
          <p className="text-uva-detalle text-uva-text-muted">{pie.pregunta}</p>
          {pie.enlace.externo ? (
            <a
              href={pie.enlace.href}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "inline-flex min-h-11 items-center rounded-uva-xs font-semibold text-uva-accent-ink underline underline-offset-3",
                FOCO,
              )}
            >
              {pie.enlace.label}
              <span className="sr-only"> (abre en otra pestaña)</span>
            </a>
          ) : (
            <Link
              href={pie.enlace.href}
              className={cn(
                "inline-flex min-h-11 items-center rounded-uva-xs font-semibold text-uva-accent-ink underline underline-offset-3",
                FOCO,
              )}
            >
              {pie.enlace.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
