import Link from "next/link";
import { cn } from "@/lib/utils";
import { CATEGORIAS_COMUNIDAD, CATEGORIA_LABEL, type CategoriaComunidad } from "@/lib/comunidad-tipos";

function CategoriaTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-uva-md border-l-[3px] border-transparent px-3.5 py-2 text-sm text-uva-text-muted transition-colors hover:bg-[#1C1C20] hover:text-uva-text",
        active && "border-uva-accent bg-uva-surface text-uva-text",
      )}
    >
      {label}
    </Link>
  );
}

/**
 * Navegación de Comunidad: categorías + "Mis publicaciones". Fila
 * horizontal con scroll en mobile/tablet (mismo lugar donde ya vivía),
 * columna vertical (riel izquierdo) desde `lg` — mismo componente y mismas
 * rutas, solo cambia la dirección del flex.
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
  return (
    <nav className="flex flex-wrap gap-1.5 lg:flex-col lg:flex-nowrap lg:gap-1" aria-label="Navegación de la comunidad">
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
  );
}
