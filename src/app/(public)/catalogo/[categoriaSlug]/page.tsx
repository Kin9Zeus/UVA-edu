import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getCategoriaConCursos } from "@/lib/categoria";
import { CategoriaContent } from "@/components/catalogo/CategoriaContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}): Promise<Metadata> {
  const { categoriaSlug } = await params;
  const categoria = await getCategoriaConCursos(categoriaSlug);
  return { title: categoria ? `U.V.A. — ${categoria.nombre}` : "U.V.A. — Categoría" };
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}) {
  const { categoriaSlug } = await params;
  const perfilActual = await getPerfilActual();
  // getCategoriaConCursos acepta slug o UUID, así que los enlaces anteriores
  // al cambio de rutas siguen resolviendo.
  const categoria = await getCategoriaConCursos(categoriaSlug);

  if (!categoria) {
    notFound();
  }

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <CategoriaContent categoria={categoria} />
      </main>
      <Footer />
    </>
  );
}
