import type { Metadata } from "next";
import { getCategoriasActivas, buscarCatalogoConProgreso, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";
import { numeroDePagina, parametroUnico, textoDeBusqueda, type ParametroUrl } from "@/lib/parametros-url";

export const metadata: Metadata = {
  title: "U.V.A. — Catálogo",
};

export default async function DashboardCatalogoPage({
  searchParams,
}: {
  // Tipo real (un parámetro repetido llega como arreglo): ver lib/parametros-url.ts.
  searchParams: Promise<{ q?: ParametroUrl; categoria?: ParametroUrl; page?: ParametroUrl }>;
}) {
  const parametros = await searchParams;
  const categoria = parametroUnico(parametros.categoria);
  const [categorias, opcionesBusqueda] = await Promise.all([getCategoriasActivas(), getCursosParaBuscador()]);
  const categoriaId = categoria ? categorias.find((fila) => fila.slug === categoria)?.id : undefined;
  const resultado = await buscarCatalogoConProgreso({
    query: textoDeBusqueda(parametros.q),
    categoriaId,
    pagina: numeroDePagina(parametros.page),
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
