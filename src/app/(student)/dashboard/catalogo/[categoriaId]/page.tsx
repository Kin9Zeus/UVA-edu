import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategoriaConCursos } from "@/lib/categoria";
import { CategoriaContent } from "@/components/dashboard/CategoriaContent";

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
  const categoria = await getCategoriaConCursos(categoriaId);

  if (!categoria) {
    notFound();
  }

  return <CategoriaContent categoria={categoria} />;
}
