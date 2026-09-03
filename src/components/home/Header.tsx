"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BuscadorHeaderInput } from "@/components/catalogo/BuscadorHeaderInput";
import { BuscadorMovilDialog } from "@/components/catalogo/BuscadorMovilDialog";
import { NavMovilDialog } from "@/components/home/NavMovilDialog";

export function Header({ ocultarBuscador = false }: { ocultarBuscador?: boolean }) {
  const [scrolled, setScrolled] = useState(false);

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
      className={`sticky top-0 z-50 flex items-center justify-between gap-5 border-b px-[clamp(20px,4vw,56px)] py-3.5 backdrop-blur-[14px] transition-[background,border-color] duration-200 [transition-timing-function:ease] ${
        scrolled
          ? "border-uva-divider bg-[rgba(9,9,11,0.86)]"
          : "border-transparent bg-[rgba(9,9,11,0.4)]"
      }`}
    >
      <Link
        href="/"
        className="shrink-0 font-heading text-2xl font-bold text-uva-text no-underline hover:no-underline"
      >
        U.V.A<span className="text-uva-accent">.</span>
      </Link>

      <div className="hidden max-w-[400px] flex-1 sm:block">
        {!ocultarBuscador && <BuscadorHeaderInput placeholder="¿Qué quieres aprender?" destino="/catalogo" />}
      </div>

      <nav
        className="flex shrink-0 items-center gap-3 min-[861px]:gap-7"
        aria-label="Navegación principal"
      >
        <div className="hidden items-center gap-5 min-[861px]:flex">
          <Link
            href="/catalogo"
            className="text-[15px] text-uva-text-muted no-underline hover:text-uva-text hover:no-underline"
          >
            Cursos
          </Link>
          <Link
            href="/#planes"
            className="text-[15px] text-uva-text-muted no-underline hover:text-uva-text hover:no-underline"
          >
            Precios
          </Link>
        </div>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-uva-md bg-uva-accent px-3.5 text-sm font-semibold text-uva-text no-underline hover:bg-uva-accent-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent min-[861px]:px-5"
        >
          Acceder
        </Link>
        {!ocultarBuscador && <BuscadorMovilDialog destino="/catalogo" className="sm:hidden" />}
        <NavMovilDialog className="min-[861px]:hidden" />
      </nav>
    </header>
  );
}
