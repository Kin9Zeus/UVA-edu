"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORIAS_COMUNIDAD, CATEGORIA_LABEL, ICONO_CATEGORIA, type CategoriaComunidad } from "@/lib/comunidad-tipos";

function CategoriaTab({ href, label, icono: Icono, active }: { href: string; label: string; icono?: LucideIcon; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        // Píldoras con el ícono amarillo de cada categoría (el mismo de las
        // tarjetas). La activa se rellena con el color del texto: se
        // distingue de un vistazo y el magenta queda para "Nueva publicación".
        "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-uva-line-strong px-4 text-uva-cuerpo font-semibold whitespace-nowrap text-uva-text transition-colors hover:border-uva-text sm:pointer-fine:min-h-9 sm:pointer-fine:text-uva-detalle",
        active && "border-uva-text bg-uva-text font-extrabold text-uva-bg",
      )}
    >
      {Icono && <Icono aria-hidden="true" className={cn("size-4", active ? "text-uva-bg" : "text-uva-accent-2-text")} />}
      {label}
    </Link>
  );
}

/**
 * Navegación de Comunidad: categorías + "Mis publicaciones", en una fila de
 * píldoras arriba del muro (con scroll horizontal si no caben).
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
        // `p-0.5`: el contorno de foco de la píldora no se corta contra el
        // borde de la fila con scroll.
        className="flex gap-2 overflow-x-auto p-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-label="Categorías de la comunidad"
      >
        <CategoriaTab href="/dashboard/comunidad" label="Todas" active={!sinActivo && !categoriaActiva && !soloPropios} />
        {CATEGORIAS_COMUNIDAD.map((categoria) => (
          <CategoriaTab
            key={categoria}
            href={`/dashboard/comunidad?categoria=${categoria}`}
            label={CATEGORIA_LABEL[categoria]}
            icono={ICONO_CATEGORIA[categoria]}
            active={!sinActivo && categoriaActiva === categoria}
          />
        ))}
        <CategoriaTab href="/dashboard/comunidad?mias=1" label="Mis publicaciones" icono={User} active={!sinActivo && !!soloPropios} />
      </nav>
      {hayAntes && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-uva-bg to-transparent"
        />
      )}
      {hayDespues && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-uva-bg to-transparent"
        />
      )}
    </div>
  );
}
