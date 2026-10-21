import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { LogoUva } from "@/components/home/LogoUva";
import { cn } from "@/lib/utils";

/**
 * Encabezado de las pantallas de foco de un curso (clase y examen), dirección
 * visual «Maqueta»: logo, una línea, "← nombre del curso" (o un título fijo,
 * como "Examen final") y las acciones a la derecha. Sin el menú lateral del
 * panel: son pantallas para concentrarse en una sola cosa.
 *
 * `logoEnCelular`: la clase lo oculta en celular para dejarle espacio al
 * botón "Temario"; el examen lo muestra, como su diseño.
 */
export function EncabezadoCurso({
  inicio,
  volver,
  titulo,
  logoEnCelular = false,
  className,
  children,
}: {
  /** Adónde lleva el logo y su nombre accesible. */
  inicio: { href: string; etiqueta: string };
  /** "← nombre del curso". En celular, sin logo, queda solo la flecha. */
  volver?: { href: string; texto: string };
  /** Texto fijo en lugar de "← curso" (p. ej. "Examen final" mientras se rinde). */
  titulo?: string;
  logoEnCelular?: boolean;
  className?: string;
  /** Acciones a la derecha: tema, cuenta, "Salir del examen"… */
  children?: ReactNode;
}) {
  return (
    <header className={cn("sticky top-0 z-40 border-b border-uva-divider bg-uva-bg lg:static", className)}>
      <div className="mx-auto flex w-full max-w-uva items-center gap-2 px-4 py-2.5 sm:px-6 lg:gap-6 lg:px-8">
        <Link
          href={inicio.href}
          aria-label={inicio.etiqueta}
          className={cn(
            "min-h-11 shrink-0 items-center text-uva-text",
            logoEnCelular ? "inline-flex" : "hidden lg:inline-flex",
          )}
        >
          <LogoUva className={cn("w-auto", logoEnCelular ? "h-6.5 lg:h-7.5" : "h-7.5")} />
        </Link>
        <span
          aria-hidden
          className={cn("h-7 w-px shrink-0 bg-uva-divider", logoEnCelular ? "hidden sm:block" : "hidden lg:block")}
        />
        {volver && (
          <Link
            href={volver.href}
            aria-label={`Volver al curso ${volver.texto}`}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center gap-1.5 font-semibold text-uva-text hover:no-underline",
              logoEnCelular ? "min-w-0" : "-ml-2 px-2 lg:ml-0 lg:min-w-0 lg:px-0",
            )}
          >
            <ChevronLeft className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            <span
              className={cn(
                "truncate text-uva-cuerpo",
                logoEnCelular ? "inline" : "hidden lg:inline",
              )}
            >
              {volver.texto}
            </span>
          </Link>
        )}
        {titulo && <p className="m-0 min-w-0 truncate text-uva-cuerpo font-semibold text-uva-text">{titulo}</p>}
        <span className="flex-1" />
        {children}
      </div>
    </header>
  );
}
