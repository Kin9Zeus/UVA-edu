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
  searchParams: Promise<{ categoria?: string; mias?: string; q?: string; orden?: string }>;
}) {
  const { categoria, mias, q, orden } = await searchParams;
  const soloPropios = mias === "1";
  const categoriaActiva = !soloPropios && esCategoriaValida(categoria) ? categoria : undefined;
  const ordenActivo = orden === "relevancia" ? "relevancia" : "reciente";

  const acceso = await resolverAccesoComunidad();
  if (!acceso.acceso) {
    return <ComunidadPausada motivo={acceso.motivo} />;
  }

  const posts = await getComunidadFeed({
    categoria: categoriaActiva,
    soloPropios,
    usuarioId: soloPropios ? acceso.usuarioId : undefined,
    busqueda: q,
    orden: ordenActivo,
  });

  return (
    <ComunidadFeedContent
      posts={posts}
      categoriaActiva={categoriaActiva}
      soloPropios={soloPropios}
      busqueda={q?.trim() || undefined}
      usuarioActualId={acceso.usuarioId}
      esAdmin={acceso.esAdmin}
    />
  );
}
