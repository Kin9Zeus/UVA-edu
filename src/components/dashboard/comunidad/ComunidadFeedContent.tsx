import { ComunidadLayout } from "@/components/dashboard/comunidad/ComunidadLayout";
import { ComunidadCategoriaTabs } from "@/components/dashboard/comunidad/ComunidadCategoriaTabs";
import { ComunidadFiltros } from "@/components/dashboard/comunidad/ComunidadFiltros";
import { ComunidadComposer } from "@/components/dashboard/comunidad/ComunidadComposer";
import { ComunidadPostCard } from "@/components/dashboard/comunidad/ComunidadPostCard";
import { ComunidadEmptyState } from "@/components/dashboard/comunidad/ComunidadEmptyState";
import { CATEGORIA_LABEL, type CategoriaComunidad, type ComunidadPostResumen } from "@/lib/comunidad-tipos";

export function ComunidadFeedContent({
  posts,
  categoriaActiva,
  soloPropios,
  busqueda,
  usuarioActualId,
  esAdmin,
}: {
  posts: ComunidadPostResumen[];
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

  return (
    <ComunidadLayout nav={<ComunidadCategoriaTabs categoriaActiva={categoriaActiva} soloPropios={soloPropios} />}>
      <div className="flex flex-col gap-5">
        <h2 className="font-heading text-lg text-uva-text">{tituloSeccion}</h2>

        <ComunidadFiltros />

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
          <div className="flex flex-col gap-3">
            {posts.map((post) => (
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
      </div>
    </ComunidadLayout>
  );
}
