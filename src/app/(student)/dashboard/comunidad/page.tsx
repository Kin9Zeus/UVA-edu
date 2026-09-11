import type { Metadata } from "next";
import { resolverAccesoComunidad, getComunidadFeed } from "@/lib/comunidad";
import { CATEGORIAS_COMUNIDAD, type CategoriaComunidad } from "@/lib/comunidad-tipos";
import { ComunidadPausada } from "@/components/dashboard/ComunidadPausada";
import { ComunidadFeedContent } from "@/components/dashboard/comunidad/ComunidadFeedContent";

export const metadata: Metadata = { title: "U.V.A. — Comunidad" };

function esCategoriaValida(valor: string | undefined): valor is CategoriaComunidad {
  return !!valor && (CATEGORIAS_COMUNIDAD as readonly string[]).includes(valor);
}

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; mias?: string }>;
}) {
  const { categoria, mias } = await searchParams;
  const soloPropios = mias === "1";
  const categoriaActiva = !soloPropios && esCategoriaValida(categoria) ? categoria : undefined;

  const acceso = await resolverAccesoComunidad();
  if (!acceso.acceso) {
    return <ComunidadPausada motivo={acceso.motivo} />;
  }

  const posts = await getComunidadFeed({
    categoria: categoriaActiva,
    soloPropios,
    usuarioId: soloPropios ? acceso.usuarioId : undefined,
  });

  return (
    <ComunidadFeedContent
      posts={posts}
      categoriaActiva={categoriaActiva}
      soloPropios={soloPropios}
      usuarioActualId={acceso.usuarioId}
      esAdmin={acceso.esAdmin}
    />
  );
}
