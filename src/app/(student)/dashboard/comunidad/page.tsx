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
  searchParams: Promise<{ categoria?: string; mias?: string; q?: string; orden?: string; page?: string }>;
}) {
  const { categoria, mias, q, orden, page } = await searchParams;
  const soloPropios = mias === "1";
  const categoriaActiva = !soloPropios && esCategoriaValida(categoria) ? categoria : undefined;
  const ordenActivo = orden === "relevancia" ? "relevancia" : "reciente";
  const paginaActiva = Math.max(1, Number(page) || 1);

  const acceso = await resolverAccesoComunidad();
  if (!acceso.acceso) {
    return <ComunidadPausada motivo={acceso.motivo} />;
  }

  const { posts, pagina, totalPaginas } = await getComunidadFeed({
    categoria: categoriaActiva,
    soloPropios,
    busqueda: q,
    orden: ordenActivo,
    pagina: paginaActiva,
  });

  return (
    <ComunidadFeedContent
      posts={posts}
      pagina={pagina}
      totalPaginas={totalPaginas}
      categoriaActiva={categoriaActiva}
      soloPropios={soloPropios}
      busqueda={q?.trim() || undefined}
      usuarioActualId={acceso.usuarioId}
      esAdmin={acceso.esAdmin}
    />
  );
}
