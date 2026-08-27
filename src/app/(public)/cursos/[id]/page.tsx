import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getCursoPublico } from "@/lib/curso";
import { esPortadaReal } from "@/lib/media";
import { CursoDetalleContent } from "@/components/curso/CursoDetalleContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { user } = await getPerfilActual();
  const curso = await getCursoPublico(id, user?.id ?? null);

  if (!curso) return { title: "U.V.A. — Curso" };

  const titulo = `U.V.A. — ${curso.titulo}`;
  // `imagenPortada` puede ser el placeholder (curso sin portada real, ver
  // lib/media.ts): en ese caso no hay nada útil que compartir como og:image.
  const imagenes = esPortadaReal(curso.imagenPortada) ? [curso.imagenPortada] : undefined;

  return {
    title: titulo,
    description: curso.descripcion,
    openGraph: {
      title: titulo,
      description: curso.descripcion,
      images: imagenes,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: curso.descripcion,
      images: imagenes,
    },
  };
}

export default async function CursoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const perfilActual = await getPerfilActual();
  const { user } = perfilActual;
  const curso = await getCursoPublico(id, user?.id ?? null);

  if (!curso) {
    notFound();
  }

  const basePath = user ? "/dashboard/catalogo" : "/catalogo";

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <CursoDetalleContent curso={curso} basePath={basePath} sesionActiva={!!user} />
      </main>
      <Footer />
    </>
  );
}
