import Link from "next/link";
import { StatusBadge } from "@/components/admin/StatusBadge";
import type { Categoria } from "@/lib/admin/categorias";

type Datos = Pick<Categoria, "activo" | "publicados">;

/** El catálogo solo lista categorías encendidas con al menos un curso publicado (lib/categoria.ts). */
export const seVeEnCatalogo = (categoria: Datos) => categoria.activo && categoria.publicados > 0;

/** «Se ve», «No se ve» o «Apagada»: lo que hoy encuentra la gente en el catálogo. */
export function EstadoEnCatalogo({ categoria }: { categoria: Datos }) {
  if (seVeEnCatalogo(categoria)) return <StatusBadge tone="success">Se ve</StatusBadge>;
  if (categoria.activo) return <StatusBadge tone="warning">No se ve</StatusBadge>;
  return <StatusBadge tone="neutral">Apagada</StatusBadge>;
}

/** El porqué del estado: su página cuando se ve, o qué le falta. */
export function NotaCatalogo({ categoria }: { categoria: Datos & Pick<Categoria, "slug"> }) {
  if (seVeEnCatalogo(categoria)) {
    return (
      <Link
        href={`/catalogo/${categoria.slug}`}
        className="inline-flex min-h-11 items-center font-codigo text-uva-etiqueta break-all text-uva-accent-text underline-offset-4 hover:underline pointer-fine:min-h-0"
      >
        /catalogo/{categoria.slug}
      </Link>
    );
  }
  if (categoria.activo) return <>No tiene cursos publicados</>;
  if (categoria.publicados === 0) return <>No sale en el catálogo</>;
  return (
    <>
      {categoria.publicados === 1
        ? "Su curso publicado sigue en el catálogo, sin esta categoría"
        : `Sus ${categoria.publicados} cursos publicados siguen en el catálogo, sin esta categoría`}
    </>
  );
}
