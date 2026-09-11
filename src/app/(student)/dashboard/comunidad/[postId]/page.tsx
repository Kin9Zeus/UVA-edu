import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolverAccesoComunidad, getComunidadPost } from "@/lib/comunidad";
import { ComunidadPausada } from "@/components/dashboard/ComunidadPausada";
import { ComunidadPostDetalleContent } from "@/components/dashboard/comunidad/ComunidadPostDetalleContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postId: string }>;
}): Promise<Metadata> {
  const { postId } = await params;
  const post = await getComunidadPost(postId);
  return { title: post ? `U.V.A. — ${post.titulo}` : "U.V.A. — Comunidad" };
}

export default async function ComunidadPostPage({ params }: { params: Promise<{ postId: string }> }) {
  const { postId } = await params;

  const acceso = await resolverAccesoComunidad();
  if (!acceso.acceso) {
    return <ComunidadPausada motivo={acceso.motivo} />;
  }

  const post = await getComunidadPost(postId);
  if (!post) {
    notFound();
  }

  return <ComunidadPostDetalleContent post={post} usuarioActualId={acceso.usuarioId} esAdmin={acceso.esAdmin} />;
}
