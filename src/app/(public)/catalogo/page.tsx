import type { Metadata } from "next";
import { Suspense } from "react";
import { getCategoriasActivas, buscarCatalogoPublico, getNivelesConCursos } from "@/lib/categoria";
import { CatalogoCursos, EsqueletoCatalogo } from "@/components/catalogo/CatalogoCursos";
import { metadataPublica } from "@/lib/seo/metadata";
import { DESCRIPCION_META_CATALOGO } from "@/lib/seo/descripciones";
import { filtrosDeUrl, type FiltrosCatalogo, type ParametrosCatalogo } from "@/lib/filtroEstado";
import { esRastreador } from "@/lib/seo/rastreador";
import { JsonLd } from "@/components/seo/JsonLd";
import { MIGAS_CATALOGO, construirMigasJsonLd } from "@/lib/seo/migas";
import { construirListaCursosJsonLd, debePublicarLista } from "@/lib/seo/lista-cursos";

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
      {/* Datos estructurados (SEO/GEO fase 14): la ruta que pinta CatalogoCursos
          (Inicio / Catálogo). La lista de cursos va con los cursos, abajo. */}
      <JsonLd data={construirMigasJsonLd(MIGAS_CATALOGO)} />
      {/* Un rastreador recibe la lista en el HTML inicial, sin esqueleto: ver lib/seo/rastreador.ts. */}
      {(await esRastreador()) ? (
        <Catalogo filtros={filtros} />
      ) : (
        <Suspense fallback={<EsqueletoCatalogo />}>
          <Catalogo filtros={filtros} />
        </Suspense>
      )}
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

  // La lista de cursos solo sin filtros, que es la versión que declara el canonical.
  const lista = debePublicarLista(filtros) ? construirListaCursosJsonLd(resultado) : null;

  return (
    <>
      <JsonLd data={lista} />
      <CatalogoCursos contexto="publico" categorias={categorias} resultado={resultado} filtros={filtros} niveles={niveles} />
    </>
  );
}
