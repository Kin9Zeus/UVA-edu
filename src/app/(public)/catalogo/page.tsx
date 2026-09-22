import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getCategoriasActivas, buscarCatalogoPublico, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";
import { metadataPublica } from "@/lib/seo/metadata";
import { numeroDePagina, parametroUnico, textoDeBusqueda, type ParametroUrl } from "@/lib/parametros-url";

export const metadata: Metadata = metadataPublica({
  titulo: "Catálogo de cursos",
  descripcion:
    "Cursos de arquitectura, obra, presupuesto y BIM. Explora el catálogo completo de U.V.A por categoría.",
  ruta: "/catalogo",
});

export default async function CatalogoPage({
  searchParams,
}: {
  // El tipo real: un parámetro repetido en la URL llega como arreglo. Ver
  // lib/parametros-url.ts (`?q=a&q=b` era un 500, AUDIT-2026-09-22.md P2-3).
  searchParams: Promise<{ q?: ParametroUrl; categoria?: ParametroUrl; page?: ParametroUrl }>;
}) {
  const parametros = await searchParams;
  const query = textoDeBusqueda(parametros.q);
  const pagina = numeroDePagina(parametros.page);
  const categoria = parametroUnico(parametros.categoria);

  const [perfilActual, categorias, opcionesBusqueda] = await Promise.all([
    getPerfilActual(),
    getCategoriasActivas(),
    getCursosParaBuscador(),
  ]);

  const categoriaId = categoria ? categorias.find((fila) => fila.slug === categoria)?.id : undefined;
  const resultado = await buscarCatalogoPublico({ query, categoriaId, pagina });

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <CatalogoContent categorias={categorias} resultado={resultado} opcionesBusqueda={opcionesBusqueda} />
      </main>
      <Footer />
    </>
  );
}
