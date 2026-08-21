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
  params: Promise<{ categoriaId: string }>;
}): Promise<Metadata> {
  const { categoriaId } = await params;
  const categoria = await getCategoriaConCursos(categoriaId);
  return { title: categoria ? `U.V.A. — ${categoria.nombre}` : "U.V.A. — Categoría" };
}

export default async function CategoriaPage({
  params,
}: {
  params: Promise<{ categoriaId: string }>;
}) {
  const { categoriaId } = await params;
  const perfilActual = await getPerfilActual();
  const categoria = await getCategoriaConCursos(categoriaId);

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
