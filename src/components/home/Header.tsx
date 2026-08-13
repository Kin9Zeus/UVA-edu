"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
    <header className={`home-header${scrolled ? " is-scrolled" : ""}`}>
      <span className="home-header__brand">
        U.V.A<span>.</span>
      </span>

      <div className="home-search">
        <span className="home-search__icon">
          <SearchIcon />
        </span>
        <input type="search" placeholder="¿Qué quieres aprender?" />
      </div>

      <nav className="home-nav" aria-label="Navegación principal">
        <div className="home-nav__links">
          <a href="#cursos">Cursos</a>
          <a href="#planes">Precios</a>
        </div>
        <Link href="/login" className="btn-solid">
          Acceder
        </Link>
      </nav>
    </header>
  );
}
