"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { SearchIcon } from "@/components/home/icons";

export function Header() {
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
      <span className="shrink-0 font-heading text-2xl font-bold text-uva-text">
        U.V.A<span className="text-uva-accent">.</span>
      </span>

      <div className="relative hidden max-w-[400px] flex-1 min-[861px]:block">
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-uva-text-faint">
          <SearchIcon />
        </span>
        <Input
          type="search"
          placeholder="¿Qué quieres aprender?"
          className="h-[46px] pl-[42px] focus-visible:outline-offset-2"
        />
      </div>

      <nav
        className="flex shrink-0 items-center gap-7"
        aria-label="Navegación principal"
      >
        <div className="hidden items-center gap-5 min-[861px]:flex">
          <a
            href="#cursos"
            className="text-[15px] text-uva-text-muted no-underline hover:text-uva-text hover:no-underline"
          >
            Cursos
          </a>
          <a
            href="#planes"
            className="text-[15px] text-uva-text-muted no-underline hover:text-uva-text hover:no-underline"
          >
            Precios
          </a>
        </div>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-uva-md bg-uva-accent px-5 text-sm font-semibold text-uva-text no-underline hover:bg-uva-accent-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
        >
          Acceder
        </Link>
      </nav>
    </header>
  );
}
