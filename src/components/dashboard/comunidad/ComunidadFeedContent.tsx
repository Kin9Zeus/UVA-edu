import Link from "next/link";
import { ChevronRight, Pin } from "lucide-react";
import { ComunidadLayout } from "@/components/dashboard/comunidad/ComunidadLayout";
import { ComunidadCategoriaTabs } from "@/components/dashboard/comunidad/ComunidadCategoriaTabs";
import { ComunidadFiltros } from "@/components/dashboard/comunidad/ComunidadFiltros";
import {
  ComunidadNuevaPublicacionBoton,
  ComunidadNuevaPublicacionDialogo,
} from "@/components/dashboard/comunidad/ComunidadNuevaPublicacion";
import { ComunidadPostCard } from "@/components/dashboard/comunidad/ComunidadPostCard";
import { ComunidadEmptyState } from "@/components/dashboard/comunidad/ComunidadEmptyState";
import { ComunidadPaginacion } from "@/components/dashboard/comunidad/ComunidadPaginacion";
import { CATEGORIA_LABEL, type CategoriaComunidad, type ComunidadPostResumen } from "@/lib/comunidad-tipos";

/** Un fijado en el muro: una franja que enlaza al detalle, no una tarjeta
 * entera — se distingue por el tinte de marca sin empujar el resto del
 * muro hacia abajo. Fijar/desfijar sigue en el menú de la publicación. */
function ComunidadFijadoFranja({ post }: { post: ComunidadPostResumen }) {
  return (
    <Link
      href={`/dashboard/comunidad/${post.slug}`}
      className="flex items-start gap-3 rounded-uva-md border border-uva-accent/50 bg-[color-mix(in_srgb,var(--uva-accent)_7%,var(--uva-surface))] py-3.5 pr-2 pl-3.5 hover:border-uva-accent sm:items-center"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-uva-accent-soft text-uva-accent-text">
        <Pin className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-uva-detalle font-bold text-uva-accent-text">
          {post.categoria === "ANUNCIOS" ? "Anuncio fijado" : "Publicación fijada"}
        </span>
        <span className="text-uva-cuerpo font-bold wrap-break-word text-uva-text">{post.titulo}</span>
        <span className="text-uva-detalle text-uva-text-muted">
          {post.autorNombre}, {post.tiempo}
        </span>
      </span>
      <ChevronRight className="mt-1.5 size-5 shrink-0 text-uva-text-muted sm:mt-0" aria-hidden="true" />
    </Link>
  );
}

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
  // `ComunidadLayout`, y las píldoras ya marcan dónde está parado el
  // usuario; este encabezado queda para el lector de pantalla.
  const tituloSeccion = soloPropios ? "Mis publicaciones" : categoriaActiva ? CATEGORIA_LABEL[categoriaActiva] : "Todas";

  // `getComunidadFeed` ya devuelve los fijados primero, en los dos órdenes
  // (comunidad.ts): esto solo corta el prefijo que ya venía arriba.
  const fijados = posts.filter((post) => post.fijado);
  const corriente = posts.filter((post) => !post.fijado);

  return (
    <ComunidadLayout
      nav={<ComunidadCategoriaTabs categoriaActiva={categoriaActiva} soloPropios={soloPropios} />}
      accion={<ComunidadNuevaPublicacionBoton variante="fija" />}
    >
      {/* Publicar es la acción principal: se ofrece en todas las pestañas.
          Desde una categoría el formulario llega con ella marcada; desde
          "Todas" o "Mis publicaciones", sin marcar. */}
      <ComunidadNuevaPublicacionDialogo ruta={ruta} categoriaInicial={categoriaActiva} esAdmin={esAdmin} />

      {/* `pb-24`: antes de `lg` el botón flota sobre el final del muro. */}
      <div className="flex flex-col gap-4 pb-24 lg:pb-0">
        <h2 className="sr-only">{tituloSeccion}</h2>

        <ComunidadFiltros />

        {posts.length === 0 ? (
          <ComunidadEmptyState categoria={categoriaActiva} soloPropios={soloPropios} busqueda={busqueda} />
        ) : (
          <div className="flex flex-col gap-3">
            {fijados.map((post) => (
              <ComunidadFijadoFranja key={post.id} post={post} />
            ))}
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
          </div>
        )}

        <ComunidadPaginacion pagina={pagina} totalPaginas={totalPaginas} />
      </div>
    </ComunidadLayout>
  );
}
