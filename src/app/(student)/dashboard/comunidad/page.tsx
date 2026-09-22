import type { Metadata } from "next";
import { resolverAccesoComunidad, getComunidadFeed } from "@/lib/comunidad";
import { CATEGORIAS_COMUNIDAD, type CategoriaComunidad } from "@/lib/comunidad-tipos";
import { ComunidadPausada } from "@/components/dashboard/ComunidadPausada";
import { ComunidadFeedContent } from "@/components/dashboard/comunidad/ComunidadFeedContent";
import { parametroUnico, type ParametroUrl } from "@/lib/parametros-url";

export const metadata: Metadata = { title: "U.V.A. — Comunidad" };

function esCategoriaValida(valor: string | undefined): valor is CategoriaComunidad {
  return !!valor && (CATEGORIAS_COMUNIDAD as readonly string[]).includes(valor);
}

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoria?: ParametroUrl;
    mias?: ParametroUrl;
    q?: ParametroUrl;
    orden?: ParametroUrl;
    page?: ParametroUrl;
  }>;
}) {
  // Tipo real: un parámetro repetido en la URL llega como arreglo, y `q` con
  // `.trim()` encima era un 500 (`?q=a&q=b`, mismo caso que el catálogo —
  // AUDIT-2026-09-22.md, P2-3). Se toma el primero de cada uno, igual que
  // `URLSearchParams.get()` en el cliente.
  const parametros = await searchParams;
  const categoria = parametroUnico(parametros.categoria);
  const mias = parametroUnico(parametros.mias);
  const q = parametroUnico(parametros.q);
  const orden = parametroUnico(parametros.orden);
  const page = parametroUnico(parametros.page);
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
