import { ComunidadLayout } from "@/components/dashboard/comunidad/ComunidadLayout";
import { ComunidadCategoriaTabs } from "@/components/dashboard/comunidad/ComunidadCategoriaTabs";
import { ComunidadFiltros } from "@/components/dashboard/comunidad/ComunidadFiltros";
import { ComunidadComposer } from "@/components/dashboard/comunidad/ComunidadComposer";
import { ComunidadPostCard } from "@/components/dashboard/comunidad/ComunidadPostCard";
import { ComunidadEmptyState } from "@/components/dashboard/comunidad/ComunidadEmptyState";
import { ComunidadPaginacion } from "@/components/dashboard/comunidad/ComunidadPaginacion";
import { CATEGORIA_LABEL, type CategoriaComunidad, type ComunidadPostResumen } from "@/lib/comunidad-tipos";

export function ComunidadFeedContent({
  posts,
  pagina,
  totalPaginas,
  categoriaActiva,
  soloPropios,
  busqueda,
  usuarioActualId,
  esAdmin,
}: {
  posts: ComunidadPostResumen[];
  pagina: number;
  totalPaginas: number;
  categoriaActiva?: CategoriaComunidad;
  soloPropios?: boolean;
  busqueda?: string;
  usuarioActualId: string;
  esAdmin: boolean;
}) {
  const ruta = soloPropios
    ? "/dashboard/comunidad?mias=1"
    : categoriaActiva
      ? `/dashboard/comunidad?categoria=${categoriaActiva}`
      : "/dashboard/comunidad";

  // El título de la marca ("Comunidad") ya vive arriba de todo, en
  // `ComunidadLayout` — este es el título de la sección actual, cambia
  // según la pestaña donde esté parado el usuario.
  const tituloSeccion = soloPropios ? "Mis publicaciones" : categoriaActiva ? CATEGORIA_LABEL[categoriaActiva] : "Todas";

  const fijados = posts.filter((post) => post.fijado);
  const corriente = posts.filter((post) => !post.fijado);

  return (
    <ComunidadLayout nav={<ComunidadCategoriaTabs categoriaActiva={categoriaActiva} soloPropios={soloPropios} />}>
      <div className="flex flex-col gap-[18px]">
        <ComunidadFiltros />

        <h2 className="text-uva-titulo-4 text-uva-text">{tituloSeccion}</h2>

        {/* Sin selector de categoría: se publica en la pestaña donde está
            parado el usuario, así que solo tiene sentido ofrecer "crear
            publicación" dentro de una categoría concreta — "Todas" y "Mis
            publicaciones" no son una categoría real donde poder publicar.
            Anuncios sigue siendo exclusivo de administradores. */}
        {categoriaActiva && !soloPropios && (categoriaActiva !== "ANUNCIOS" || esAdmin) && (
          <ComunidadComposer ruta={ruta} categoria={categoriaActiva} />
        )}

        {posts.length === 0 ? (
          <ComunidadEmptyState categoria={categoriaActiva} soloPropios={soloPropios} busqueda={busqueda} />
        ) : (
          <div className="grid grid-cols-1 items-stretch gap-5 @min-[620px]:grid-cols-2 @min-[980px]:grid-cols-3">
            {/* Cartelera: cada publicación es una nota clavada. Los fijados
                ocupan la fila entera y van primero — `getComunidadFeed` ya
                los devuelve arriba en los dos órdenes (comunidad.ts:271 y
                :311), así que esto solo corta ese prefijo. */}
            {fijados.length > 0 && (
              <div className="col-span-full grid gap-5">
                {fijados.map((post) => (
                  <ComunidadPostCard
                    key={post.id}
                    post={post}
                    ruta={ruta}
                    usuarioActualId={usuarioActualId}
                    esAdmin={esAdmin}
                    truncar
                  />
                ))}
              </div>
            )}

            {corriente.length > 0 && (
              <>
                {corriente.map((post) => (
                  <ComunidadPostCard
                    key={post.id}
                    post={post}
                    ruta={ruta}
                    usuarioActualId={usuarioActualId}
                    esAdmin={esAdmin}
                    truncar
                  />
                ))}
              </>
            )}
          </div>
        )}

        <ComunidadPaginacion pagina={pagina} totalPaginas={totalPaginas} />
      </div>
    </ComunidadLayout>
  );
}
