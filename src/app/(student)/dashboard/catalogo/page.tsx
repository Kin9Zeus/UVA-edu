import type { Metadata } from "next";
import { getCategoriasActivas, buscarCatalogo, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";

export const metadata: Metadata = {
  title: "U.V.A. — Catálogo",
};

export default async function DashboardCatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; page?: string }>;
}) {
  const { q, categoria, page } = await searchParams;
  const [categorias, opcionesBusqueda] = await Promise.all([getCategoriasActivas(), getCursosParaBuscador()]);
  const categoriaId = categoria ? categorias.find((fila) => fila.slug === categoria)?.id : undefined;
  const resultado = await buscarCatalogo({
    query: q,
    categoriaId,
    pagina: page ? Number(page) : 1,
    incluirProgreso: true,
  });

  return (
    <CatalogoContent
      categorias={categorias}
      resultado={resultado}
      opcionesBusqueda={opcionesBusqueda}
      basePath="/dashboard/catalogo"
      volverHref="/dashboard"
    />
  );
}
