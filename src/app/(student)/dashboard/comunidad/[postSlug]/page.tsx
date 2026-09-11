import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { resolverAccesoComunidad, getComunidadPost } from "@/lib/comunidad";
import { esUuid } from "@/lib/slug";
import { ComunidadPausada } from "@/components/dashboard/ComunidadPausada";
import { ComunidadPostDetalleContent } from "@/components/dashboard/comunidad/ComunidadPostDetalleContent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ postSlug: string }>;
}): Promise<Metadata> {
  const { postSlug } = await params;
  const post = await getComunidadPost(postSlug);
  return { title: post ? `U.V.A. — ${post.titulo}` : "U.V.A. — Comunidad" };
}

export default async function ComunidadPostPage({ params }: { params: Promise<{ postSlug: string }> }) {
  const { postSlug } = await params;

  const acceso = await resolverAccesoComunidad();
  if (!acceso.acceso) {
    return <ComunidadPausada motivo={acceso.motivo} />;
  }

  const post = await getComunidadPost(postSlug);
  if (!post) {
    notFound();
  }

  // Enlace viejo con el UUID: misma publicación con su slug, para que la barra
  // nunca muestre el id. `redirect` (307) y no `permanentRedirect`, igual que
  // el resto de fichas con slug.
  if (esUuid(postSlug)) {
    redirect(`/dashboard/comunidad/${post.slug}`);
  }

  return <ComunidadPostDetalleContent post={post} usuarioActualId={acceso.usuarioId} esAdmin={acceso.esAdmin} />;
}
