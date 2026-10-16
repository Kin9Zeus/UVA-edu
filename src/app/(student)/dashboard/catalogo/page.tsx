import type { Metadata } from "next";
import {
  getCategoriasActivas,
  buscarCatalogoConProgreso,
  filtroEstadoDeUrl,
  getCursosParaBuscador,
} from "@/lib/categoria";
import { CatalogoCursos } from "@/components/catalogo/CatalogoCursos";
import { numeroDePagina, parametroUnico, textoDeBusqueda, type ParametroUrl } from "@/lib/parametros-url";

export const metadata: Metadata = {
  title: "U.V.A. — Catálogo",
};

export default async function DashboardCatalogoPage({
  searchParams,
}: {
  // Tipo real (un parámetro repetido llega como arreglo): ver lib/parametros-url.ts.
  searchParams: Promise<{ q?: ParametroUrl; categoria?: ParametroUrl; estado?: ParametroUrl; page?: ParametroUrl }>;
}) {
  const parametros = await searchParams;
  const categoria = parametroUnico(parametros.categoria);
  const [categorias, opcionesBusqueda] = await Promise.all([getCategoriasActivas(), getCursosParaBuscador()]);
  const categoriaId = categoria ? categorias.find((fila) => fila.slug === categoria)?.id : undefined;
  const resultado = await buscarCatalogoConProgreso({
    query: textoDeBusqueda(parametros.q),
    categoriaId,
    pagina: numeroDePagina(parametros.page),
    estado: filtroEstadoDeUrl(parametroUnico(parametros.estado)),
  });

  return (
    <CatalogoCursos
      contexto="panel"
      categorias={categorias}
      resultado={resultado}
      opcionesBusqueda={opcionesBusqueda}
    />
  );
}
