import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolverCategoria, buscarCatalogoPublico, getNivelesConCursos } from "@/lib/categoria";
import { CatalogoCursos } from "@/components/catalogo/CatalogoCursos";
import { esUuid } from "@/lib/slug";
import { metadataPublica } from "@/lib/seo/metadata";
import { filtrosDeUrl, hrefCatalogo, type ParametrosCatalogo } from "@/lib/filtroEstado";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}): Promise<Metadata> {
  const { categoriaSlug } = await params;
  const categoria = await resolverCategoria(categoriaSlug);

  if (!categoria) {
    // La página hará notFound(); esto solo evita anunciar un canonical a una
    // ruta que devuelve 404.
    return { title: "U.V.A. — Categoría" };
  }

  // El canonical apunta SIEMPRE al slug, nunca al uuid con el que se pudo
  // llegar: `resolverCategoria` acepta los dos (enlaces anteriores al cambio
  // de rutas), así que sin esto la misma lista vive en dos direcciones y
  // Google las ve como contenido duplicado. Mismo criterio que la ficha de
  // curso, que ya lo hacía.
  return metadataPublica({
    titulo: categoria.nombre,
    descripcion: `Cursos de ${categoria.nombre.toLowerCase()} en U.V.A.: formación técnica para el oficio de la construcción.`,
    ruta: `/catalogo/${categoria.slug}`,
  });
}

export default async function CategoriaPage({
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
    redirect(hrefCatalogo(`/catalogo/${categoria.slug}`, filtros, { categoria: undefined, pagina: filtros.pagina }));
  }

  const resultado = await buscarCatalogoPublico({
    query: filtros.q,
    categoriaId: categoria.id,
    nivel: niveles.length > 1 ? filtros.nivel : undefined,
    pagina: filtros.pagina,
  });

  return (
    <main id="contenido" tabIndex={-1}>
      <CatalogoCursos
        contexto="publico"
        categorias={[]}
        resultado={resultado}
        filtros={filtros}
        niveles={niveles}
        categoriaFija={categoria}
      />
    </main>
  );
}
