import type { Metadata } from "next";
import { getCategoriasActivas, buscarCatalogoConProgreso, getNivelesConCursos } from "@/lib/categoria";
import { CatalogoCursos } from "@/components/catalogo/CatalogoCursos";
import { filtrosDeUrl, type ParametrosCatalogo } from "@/lib/filtroEstado";

export const metadata: Metadata = {
  title: "U.V.A. — Catálogo",
};

export default async function DashboardCatalogoPage({
  searchParams,
}: {
  // Tipo real (un parámetro repetido llega como arreglo): ver lib/parametros-url.ts.
  searchParams: Promise<ParametrosCatalogo>;
}) {
  const filtros = filtrosDeUrl(await searchParams);
  const [categorias, niveles] = await Promise.all([getCategoriasActivas(), getNivelesConCursos()]);
  const categoriaId = filtros.categoria ? categorias.find((fila) => fila.slug === filtros.categoria)?.id : undefined;
  const resultado = await buscarCatalogoConProgreso({
    query: filtros.q,
    categoriaId,
    nivel: niveles.length > 1 ? filtros.nivel : undefined,
    pagina: filtros.pagina,
    estado: filtros.estado,
  });

  return (
    <CatalogoCursos contexto="panel" categorias={categorias} resultado={resultado} filtros={filtros} niveles={niveles} />
  );
}
