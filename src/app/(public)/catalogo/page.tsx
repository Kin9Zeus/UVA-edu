import type { Metadata } from "next";
import { Suspense } from "react";
import { getCategoriasActivas, buscarCatalogoPublico, getNivelesConCursos } from "@/lib/categoria";
import { CatalogoCursos, EsqueletoCatalogo } from "@/components/catalogo/CatalogoCursos";
import { metadataPublica } from "@/lib/seo/metadata";
import { DESCRIPCION_META_CATALOGO } from "@/lib/seo/descripciones";
import { filtrosDeUrl, type FiltrosCatalogo, type ParametrosCatalogo } from "@/lib/filtroEstado";

export const metadata: Metadata = metadataPublica({
  titulo: "Catálogo de cursos",
  descripcion: DESCRIPCION_META_CATALOGO,
  ruta: "/catalogo",
});

export default async function CatalogoPage({
  searchParams,
}: {
  // El tipo real: un parámetro repetido en la URL llega como arreglo. Ver
  // lib/parametros-url.ts (`?q=a&q=b` era un 500, AUDIT-2026-09-22.md P2-3).
  searchParams: Promise<ParametrosCatalogo>;
}) {
  const filtros = filtrosDeUrl(await searchParams);
  // El esqueleto va aquí y no en un loading.tsx de /catalogo: ese también
  // envolvía a las escuelas y les impedía responder 404 (ver
  // [categoriaSlug]/page.tsx).
  return (
    <main id="contenido" tabIndex={-1}>
      <Suspense fallback={<EsqueletoCatalogo />}>
        <Catalogo filtros={filtros} />
      </Suspense>
    </main>
  );
}

async function Catalogo({ filtros }: { filtros: FiltrosCatalogo }) {
  const [categorias, niveles] = await Promise.all([getCategoriasActivas(), getNivelesConCursos()]);

  const categoriaId = filtros.categoria ? categorias.find((fila) => fila.slug === filtros.categoria)?.id : undefined;
  const resultado = await buscarCatalogoPublico({
    query: filtros.q,
    categoriaId,
    nivel: niveles.length > 1 ? filtros.nivel : undefined,
    pagina: filtros.pagina,
  });

  return <CatalogoCursos contexto="publico" categorias={categorias} resultado={resultado} filtros={filtros} niveles={niveles} />;
}
