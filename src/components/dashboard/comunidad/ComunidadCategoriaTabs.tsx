"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CATEGORIAS_COMUNIDAD, CATEGORIA_LABEL, type CategoriaComunidad } from "@/lib/comunidad-tipos";

function CategoriaTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Móvil: pestaña subrayada, como las del panel admin. Desde `lg`: ítem
        // del riel vertical, marcado con el borde izquierdo — ese borde en
        // chips sueltos que bajaban de línea se veía como un error.
        "shrink-0 border-b-2 border-transparent px-1 py-2.5 text-sm whitespace-nowrap text-uva-text-muted transition-colors hover:text-uva-text lg:rounded-uva-md lg:border-b-0 lg:border-l-[3px] lg:px-3.5 lg:py-2 lg:hover:bg-[#1C1C20]",
        active && "border-uva-accent text-uva-text lg:bg-uva-surface",
      )}
    >
      {label}
    </Link>
  );
}

/**
 * Navegación de Comunidad: categorías + "Mis publicaciones". Una sola fila
 * con scroll horizontal en mobile/tablet y columna vertical (riel izquierdo)
 * desde `lg` — mismo componente y mismas rutas.
 *
 * Antes la fila hacía `flex-wrap`: a 375 px las seis pestañas ocupaban 4
 * filas (162 px) y el primer post empezaba pasada la mitad de la pantalla.
 *
 * `sinActivo` es para la página de detalle de un post: ahí no hay una
 * categoría "actual" ni un filtro de "mías" que resaltar.
 */
export function ComunidadCategoriaTabs({
  categoriaActiva,
  soloPropios,
  sinActivo,
}: {
  categoriaActiva?: CategoriaComunidad;
  soloPropios?: boolean;
  sinActivo?: boolean;
}) {
  // Degradados a los dos lados de la fila, solo cuando hay pestañas fuera
  // de vista por ese lado — mismo patrón que las pestañas de CursoDetalleView.
  const navRef = useRef<HTMLElement>(null);
  const [hayAntes, setHayAntes] = useState(false);
  const [hayDespues, setHayDespues] = useState(false);

  // Al entrar a "Empleo" o "Mis publicaciones" la pestaña activa queda fuera
  // de la fila en móvil, así que se centra — una vez por pestaña activa, para
  // no pelear con el scroll del usuario. Se mueve solo el scroll horizontal
  // de la nav: `scrollIntoView` también podría desplazar el <main> en vertical.
  const claveActiva = sinActivo ? null : soloPropios ? "mias" : (categoriaActiva ?? "todas");
  const centradaParaRef = useRef<string | null>(null);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const nav = el;
    function actualizar() {
      if (claveActiva && centradaParaRef.current !== claveActiva && nav.scrollWidth > nav.clientWidth) {
        const activa = nav.querySelector<HTMLElement>('[aria-current="page"]');
        if (activa) nav.scrollLeft = activa.offsetLeft - (nav.clientWidth - activa.offsetWidth) / 2;
        centradaParaRef.current = claveActiva;
      }
      setHayDespues(nav.scrollWidth - nav.scrollLeft - nav.clientWidth > 4);
      setHayAntes(nav.scrollLeft > 4);
    }
    // ResizeObserver y no solo una medición al montar: medido en local, el
    // efecto a veces corría antes de que la fila tuviera su CSS (seguía en
    // columna, sin desborde) y no volvía a medir — sin degradado y con la
    // pestaña activa fuera de vista. También cubre el cambio de ancho de
    // ventana, que antes escuchaba `resize`.
    actualizar();
    const observador = new ResizeObserver(actualizar);
    observador.observe(nav);
    nav.addEventListener("scroll", actualizar);
    return () => {
      observador.disconnect();
      nav.removeEventListener("scroll", actualizar);
    };
  }, [claveActiva]);

  return (
    <div className="relative">
      <nav
        ref={navRef}
        className="flex gap-4 overflow-x-auto border-b border-uva-divider [scrollbar-width:none] lg:flex-col lg:gap-1 lg:overflow-visible lg:border-b-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Navegación de la comunidad"
      >
        <CategoriaTab href="/dashboard/comunidad" label="Todas" active={!sinActivo && !categoriaActiva && !soloPropios} />
        {CATEGORIAS_COMUNIDAD.map((categoria) => (
          <CategoriaTab
            key={categoria}
            href={`/dashboard/comunidad?categoria=${categoria}`}
            label={CATEGORIA_LABEL[categoria]}
            active={!sinActivo && categoriaActiva === categoria}
          />
        ))}
        <div className="my-1 hidden border-t border-uva-divider lg:block" />
        <CategoriaTab href="/dashboard/comunidad?mias=1" label="Mis publicaciones" active={!sinActivo && !!soloPropios} />
      </nav>
      {hayAntes && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-uva-bg to-transparent lg:hidden"
        />
      )}
      {hayDespues && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-uva-bg to-transparent lg:hidden"
        />
      )}
    </div>
  );
}
