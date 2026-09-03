import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolverCategoria, buscarCatalogo, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";

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
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { categoriaSlug } = await params;
  const { q, page } = await searchParams;
  // resolverCategoria acepta slug o UUID, así que los enlaces anteriores al
  // cambio de rutas siguen resolviendo.
  const categoria = await resolverCategoria(categoriaSlug);

  if (!categoria) {
    notFound();
  }

  const [resultado, opcionesBusqueda] = await Promise.all([
    buscarCatalogo({
      query: q,
      categoriaId: categoria.id,
      pagina: page ? Number(page) : 1,
      incluirProgreso: true,
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
