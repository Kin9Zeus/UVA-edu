import Link from "next/link";
import { cn } from "@/lib/utils";

type AccionPrimaria =
  | { label: string; href: string; onClick?: never }
  | { label: string; onClick: () => void; href?: never };

type ErrorBlockProps = {
  /** Standalone en rutas públicas (min-h-screen); dentro del layout con sidebar, min-h-full. */
  standalone?: boolean;
  codigo: string;
  /** 500 usa el código en gris apagado en vez del texto principal. */
  codigoMuted?: boolean;
  /** 404 usa un punto magenta; 403 usa una raya. Se omite en 500. */
  indicador?: "punto" | "raya";
  titulo: string;
  texto: string;
  accionPrimaria: AccionPrimaria;
  accionSecundaria: { label: string; href: string };
  /** Línea corta tipo "HTTP 404 · /catalogo" (404 y 403). */
  meta?: string;
  /** Bloque con borde tipo "error_id: …" (500). */
  trace?: string;
};

export function ErrorBlock({
  standalone,
  codigo,
  codigoMuted,
  indicador,
  titulo,
  texto,
  accionPrimaria,
  accionSecundaria,
  meta,
  trace,
}: ErrorBlockProps) {
  return (
    <main
      className={cn(
        "flex items-center justify-center bg-[linear-gradient(168deg,#101013_0%,var(--uva-bg)_52%,var(--uva-bg)_100%)] px-[clamp(20px,5vw,48px)] py-[clamp(40px,8vh,88px)]",
        standalone ? "min-h-screen" : "min-h-full",
      )}
    >
      <div className="flex w-full max-w-[480px] flex-col items-start gap-[18px]">
        <div className="flex items-baseline gap-3.5">
          <span
            className={cn(
              "font-heading text-[64px] leading-[0.85] font-extrabold tracking-[-0.055em] sm:text-[92px]",
              codigoMuted ? "text-uva-muted-2" : "text-uva-text",
            )}
          >
            {codigo}
          </span>
          {indicador === "punto" && (
            <span aria-hidden className="mb-3 size-3 rounded-full bg-uva-accent" />
          )}
          {indicador === "raya" && (
            <span aria-hidden className="mb-4 h-0.5 w-9 bg-uva-accent" />
          )}
        </div>

        <div className="flex flex-col gap-[9px]">
          <h1 className="m-0 font-heading text-xl leading-[1.25] font-bold tracking-[-0.03em] text-uva-text sm:text-[23px]">
            {titulo}
          </h1>
          <p className="m-0 text-pretty text-[14.5px] leading-[1.6] text-uva-muted">
            {texto}
          </p>
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-3.5 sm:gap-[18px]">
          {accionPrimaria.href ? (
            <Link
              href={accionPrimaria.href}
              className="inline-flex h-[42px] items-center rounded-uva-md bg-uva-accent px-5 text-sm font-semibold text-uva-text transition-colors hover:bg-uva-accent-hover"
            >
              {accionPrimaria.label}
            </Link>
          ) : (
            <button
              type="button"
              onClick={accionPrimaria.onClick}
              className="inline-flex h-[42px] items-center rounded-uva-md bg-uva-accent px-5 text-sm font-semibold text-uva-text transition-colors hover:bg-uva-accent-hover"
            >
              {accionPrimaria.label}
            </button>
          )}
          <Link
            href={accionSecundaria.href}
            className="border-b border-uva-divider pb-0.5 text-[13.5px] text-uva-muted transition-colors hover:border-uva-dim hover:text-uva-text"
          >
            {accionSecundaria.label}
          </Link>
        </div>

        {meta && (
          <div className="mt-1.5 font-mono text-[11px] tracking-[0.1em] text-uva-dim">
            {meta}
          </div>
        )}
        {trace && (
          <div className="mt-1.5 w-full rounded-uva-md border border-uva-divider bg-uva-surface-2 px-3 py-2.5 font-mono text-[11px] leading-[1.5] text-uva-muted-2">
            {trace}
          </div>
        )}
      </div>
    </main>
  );
}
