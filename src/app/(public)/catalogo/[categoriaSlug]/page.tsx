import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { resolverCategoria, buscarCatalogoPublico, getNivelesConCursos, type CategoriaInfo } from "@/lib/categoria";
import { CatalogoCursos, EsqueletoCatalogo } from "@/components/catalogo/CatalogoCursos";
import { esUuid } from "@/lib/slug";
import { slugActual } from "@/lib/slugs-anteriores";
import { metadataPublica } from "@/lib/seo/metadata";
import { descripcionEscuela, recortarDescripcion } from "@/lib/seo/descripciones";
import { filtrosDeUrl, hrefCatalogo, type FiltrosCatalogo, type ParametrosCatalogo } from "@/lib/filtroEstado";

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
    return { title: "Categoría" };
  }

  // El canonical apunta SIEMPRE al slug, nunca al uuid con el que se pudo
  // llegar: `resolverCategoria` acepta los dos (enlaces anteriores al cambio
  // de rutas), así que sin esto la misma lista vive en dos direcciones y
  // Google las ve como contenido duplicado. Mismo criterio que la ficha de
  // curso, que ya lo hacía.
  return metadataPublica({
    // Plantilla de la tarea de metadatos: «Cursos de [escuela]». El público
    // («para residentes de obra…») queda para cuando Aleck lo defina.
    titulo: `Cursos de ${categoria.nombre}`,
    // La descripción propia de la escuela (se edita en /admin/categorias) para
    // que cada escuela no compita con el catálogo con el mismo texto (SEO
    // fase 14, docs/seo/03-mapa-contenidos.md). La plantilla queda de respaldo.
    descripcion: recortarDescripcion(categoria.descripcion?.trim() || descripcionEscuela(categoria.nombre)),
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
  // Primero se comprueba que la escuela existe y DESPUÉS se muestra el
  // esqueleto: con el esqueleto ya enviado el estado queda en 200 y un 404 o
  // una redirección solo pueden ir dentro del HTML (SEO fase 14, tarea de
  // robots.txt, paso 3). resolverCategoria suele salir de caché.
  const categoria = await resolverCategoria(categoriaSlug);

  if (!categoria) {
    // Slug viejo (la escuela cambió de nombre): 308 conservando los filtros.
    const actual = await slugActual("categorias", categoriaSlug);
    if (actual) {
      permanentRedirect(hrefCatalogo(`/catalogo/${actual}`, filtros, { categoria: undefined, pagina: filtros.pagina }));
    }
    notFound();
  }

  // Enlace viejo con UUID: misma página con slug, conservando los filtros.
  // 308: ver /cursos/[cursoSlug]/page.tsx.
  if (esUuid(categoriaSlug)) {
    permanentRedirect(hrefCatalogo(`/catalogo/${categoria.slug}`, filtros, { categoria: undefined, pagina: filtros.pagina }));
  }

  return (
    <main id="contenido" tabIndex={-1}>
      <Suspense fallback={<EsqueletoCatalogo />}>
        <CursosDeEscuela categoria={categoria} filtros={filtros} />
      </Suspense>
    </main>
  );
}

async function CursosDeEscuela({ categoria, filtros }: { categoria: CategoriaInfo; filtros: FiltrosCatalogo }) {
  const niveles = await getNivelesConCursos();
  const resultado = await buscarCatalogoPublico({
    query: filtros.q,
    categoriaId: categoria.id,
    nivel: niveles.length > 1 ? filtros.nivel : undefined,
    pagina: filtros.pagina,
  });

  return (
    <CatalogoCursos
      contexto="publico"
      categorias={[]}
      resultado={resultado}
      filtros={filtros}
      niveles={niveles}
      categoriaFija={categoria}
    />
  );
}
