"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BuscadorHeaderInput } from "@/components/catalogo/BuscadorHeaderInput";
import { BuscadorMovilDialog } from "@/components/catalogo/BuscadorMovilDialog";
import { NavMovilDialog } from "@/components/home/NavMovilDialog";
import { SelectorTemaBoton } from "@/components/tema/SelectorTema";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { LogoUva } from "@/components/home/LogoUva";

const CLASE_ENLACE =
  "relative inline-flex min-h-11 items-center text-uva-cuerpo font-semibold text-uva-text no-underline hover:text-uva-accent-ink hover:no-underline";
// Sección actual: subrayado grueso, como la línea de título de una lámina.
const CLASE_ACTIVO = "font-extrabold after:absolute after:inset-x-0 after:bottom-1 after:h-[3px] after:bg-uva-accent-ink";

export function Header({ ocultarBuscador = false }: { ocultarBuscador?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const enCatalogo = pathname === "/catalogo" || pathname.startsWith("/catalogo/");

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 20);
    }
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 flex items-center gap-1 border-b py-2.5 pr-[max(0.5rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:gap-6 sm:pr-[max(var(--spacing-uva-margen),env(safe-area-inset-right))] sm:pl-[max(var(--spacing-uva-margen),env(safe-area-inset-left))] lg:gap-10 lg:py-3.5 backdrop-blur-[14px] transition-[background,border-color] duration-200 [transition-timing-function:ease] ${
        scrolled
          ? "border-uva-divider bg-uva-bg/86"
          : "border-transparent bg-uva-bg/40"
      }`}
    >
      <Link
        href="/"
        aria-label="U.V.A., ir al inicio"
        className="mr-auto inline-flex min-h-11 shrink-0 items-center text-uva-text no-underline hover:no-underline sm:mr-0"
      >
        <LogoUva className="h-[25px] w-[77px] lg:h-[34px] lg:w-[105px]" />
      </Link>

      <div className="hidden max-w-[420px] min-w-0 flex-1 sm:block">
        {!ocultarBuscador && <BuscadorHeaderInput placeholder="¿Qué quieres aprender?" destino="/catalogo" />}
      </div>

      <nav className="flex shrink-0 items-center gap-1 sm:ml-auto lg:gap-7" aria-label="Navegación principal">
        <div className="hidden items-center gap-7 lg:flex">
          <Link
            href="/catalogo"
            aria-current={enCatalogo ? "page" : undefined}
            className={`${CLASE_ENLACE} ${enCatalogo ? CLASE_ACTIVO : ""}`}
          >
            Catálogo
          </Link>
          {PRECIOS_HABILITADOS && (
            <Link href="/#planes" className={CLASE_ENLACE}>
              Precios
            </Link>
          )}
          <Link href="/#verificar-certificado" className={CLASE_ENLACE}>
            Verificar certificado
          </Link>
        </div>
        {/* Por debajo de lg no cabe junto a "Entrar", la lupa y el menú: ahí
            vive dentro del menú móvil (NavMovilDialog). */}
        <SelectorTemaBoton className="hidden rounded-uva-md border-[1.5px] border-uva-line-strong text-uva-text lg:inline-flex" />
        {!ocultarBuscador && <BuscadorMovilDialog destino="/catalogo" className="size-11 text-uva-text sm:hidden" />}
        {/* En celular el botón se ve de 36 px pero el enlace mide 44 px de
            alto: el área de toque cumple el mínimo sin que el botón pese. */}
        <Link
          href="/login"
          className="group inline-flex min-h-11 items-center px-0.5 no-underline hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent lg:px-0"
        >
          <span className="inline-flex h-9 items-center gap-1.5 rounded-uva-sm bg-uva-btn px-2.5 text-uva-detalle font-semibold text-uva-on-accent group-hover:bg-uva-btn-hover lg:h-11 lg:rounded-uva-md lg:px-[22px] lg:text-uva-cuerpo">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
              className="size-[18px] lg:hidden"
            >
              <circle cx="12" cy="8.5" r="4" />
              <path d="M4.5 20.5c1.2-4 4.2-6 7.5-6s6.3 2 7.5 6" />
            </svg>
            Entrar
          </span>
        </Link>
        <NavMovilDialog className="size-11 text-uva-text lg:hidden" />
      </nav>
    </header>
  );
}
