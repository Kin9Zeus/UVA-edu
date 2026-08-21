import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { getCursoPublico } from "@/lib/curso";
import { CursoDetalleContent } from "@/components/curso/CursoDetalleContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { user } = await getPerfilActual();
  const curso = await getCursoPublico(id, user?.id ?? null);
  return { title: curso ? `U.V.A. — ${curso.titulo}` : "U.V.A. — Curso" };
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

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <CursoDetalleContent curso={curso} />
      </main>
      <Footer />
    </>
  );
}
