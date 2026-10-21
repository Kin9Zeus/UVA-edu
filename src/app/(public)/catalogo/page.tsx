import type { Metadata } from "next";
import { getCategoriasActivas, buscarCatalogoPublico, getNivelesConCursos } from "@/lib/categoria";
import { CatalogoCursos } from "@/components/catalogo/CatalogoCursos";
import { metadataPublica } from "@/lib/seo/metadata";
import { filtrosDeUrl, type ParametrosCatalogo } from "@/lib/filtroEstado";

export const metadata: Metadata = metadataPublica({
  titulo: "Catálogo de cursos",
  descripcion:
    "Cursos de arquitectura, obra, presupuesto y BIM. Explora el catálogo completo de U.V.A. por escuela y nivel.",
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
  const [categorias, niveles] = await Promise.all([getCategoriasActivas(), getNivelesConCursos()]);

  const categoriaId = filtros.categoria ? categorias.find((fila) => fila.slug === filtros.categoria)?.id : undefined;
  const resultado = await buscarCatalogoPublico({
    query: filtros.q,
    categoriaId,
    nivel: niveles.length > 1 ? filtros.nivel : undefined,
    pagina: filtros.pagina,
  });

  return (
    <main id="contenido" tabIndex={-1}>
      <CatalogoCursos contexto="publico" categorias={categorias} resultado={resultado} filtros={filtros} niveles={niveles} />
    </main>
  );
}
