import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolverCategoria, buscarCatalogoConProgreso, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";
import { esUuid } from "@/lib/slug";
import { numeroDePagina, textoDeBusqueda, type ParametroUrl } from "@/lib/parametros-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}): Promise<Metadata> {
  const { categoriaSlug } = await params;
  const categoria = await resolverCategoria(categoriaSlug);
  return { title: categoria ? `U.V.A. — ${categoria.nombre}` : "U.V.A. — Categoría" };
}

export default async function DashboardCategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoriaSlug: string }>;
  // Tipo real (un parámetro repetido llega como arreglo): ver lib/parametros-url.ts.
  searchParams: Promise<{ q?: ParametroUrl; page?: ParametroUrl }>;
}) {
  const { categoriaSlug } = await params;
  const parametros = await searchParams;
  const q = textoDeBusqueda(parametros.q);
  const pagina = numeroDePagina(parametros.page);
  // Solo se lleva `page` al redirect de abajo si la URL la traía.
  const page = parametros.page === undefined ? undefined : String(pagina);
  // resolverCategoria acepta slug o UUID, así que los enlaces anteriores al
  // cambio de rutas siguen resolviendo.
  const categoria = await resolverCategoria(categoriaSlug);

  if (!categoria) {
    notFound();
  }

  // Enlace viejo con UUID: misma página con slug, conservando la búsqueda y
  // la página. Motivo del 307 en /cursos/[cursoSlug]/page.tsx.
  if (esUuid(categoriaSlug)) {
    const consulta = new URLSearchParams({ ...(q ? { q } : {}), ...(page ? { page } : {}) }).toString();
    redirect(`/dashboard/catalogo/${categoria.slug}${consulta ? `?${consulta}` : ""}`);
  }

  const [resultado, opcionesBusqueda] = await Promise.all([
    buscarCatalogoConProgreso({
      query: q,
      categoriaId: categoria.id,
      pagina,
    }),
    getCursosParaBuscador(),
  ]);

  return (
    <CatalogoContent
      categorias={[]}
      resultado={resultado}
      opcionesBusqueda={opcionesBusqueda}
      categoriaFija={categoria}
      basePath="/dashboard/catalogo"
    />
  );
}
