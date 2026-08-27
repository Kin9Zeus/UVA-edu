import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getCategoriasActivas, buscarCatalogo, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";

export const metadata: Metadata = { title: "U.V.A. — Catálogo" };

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
  const resultado = await buscarCatalogo({ query: q, categoriaId, pagina: page ? Number(page) : 1 });

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
