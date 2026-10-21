import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolverCategoria, buscarCatalogoConProgreso, getNivelesConCursos } from "@/lib/categoria";
import { CatalogoCursos } from "@/components/catalogo/CatalogoCursos";
import { esUuid } from "@/lib/slug";
import { filtrosDeUrl, hrefCatalogo, type ParametrosCatalogo } from "@/lib/filtroEstado";

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
  searchParams: Promise<ParametrosCatalogo>;
}) {
  const { categoriaSlug } = await params;
  const filtros = filtrosDeUrl(await searchParams);
  // resolverCategoria acepta slug o UUID, así que los enlaces anteriores al
  // cambio de rutas siguen resolviendo.
  const [categoria, niveles] = await Promise.all([resolverCategoria(categoriaSlug), getNivelesConCursos()]);

  if (!categoria) {
    notFound();
  }

  // Enlace viejo con UUID: misma página con slug, conservando los filtros.
  // Motivo del 307 en /cursos/[cursoSlug]/page.tsx.
  if (esUuid(categoriaSlug)) {
    redirect(hrefCatalogo(`/dashboard/catalogo/${categoria.slug}`, filtros, { categoria: undefined, pagina: filtros.pagina }));
  }

  const resultado = await buscarCatalogoConProgreso({
    query: filtros.q,
    categoriaId: categoria.id,
    nivel: niveles.length > 1 ? filtros.nivel : undefined,
    pagina: filtros.pagina,
    estado: filtros.estado,
  });

  return (
    <CatalogoCursos
      contexto="panel"
      categorias={[]}
      resultado={resultado}
      filtros={filtros}
      niveles={niveles}
      categoriaFija={categoria}
    />
  );
}
