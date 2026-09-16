import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getCategoriasActivas, buscarCatalogoPublico, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";
import { metadataPublica } from "@/lib/seo/metadata";

export const metadata: Metadata = metadataPublica({
  titulo: "Catálogo de cursos",
  descripcion:
    "Cursos de arquitectura, obra, presupuesto y BIM. Explora el catálogo completo de U.V.A por categoría.",
  ruta: "/catalogo",
});

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoria?: string; page?: string }>;
}) {
  const { q, categoria, page } = await searchParams;
  const [perfilActual, categorias, opcionesBusqueda] = await Promise.all([
    getPerfilActual(),
    getCategoriasActivas(),
    getCursosParaBuscador(),
  ]);

  const categoriaId = categoria ? categorias.find((fila) => fila.slug === categoria)?.id : undefined;
  const resultado = await buscarCatalogoPublico({ query: q, categoriaId, pagina: page ? Number(page) : 1 });

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
