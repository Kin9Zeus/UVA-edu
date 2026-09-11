import { ComunidadLayout } from "@/components/dashboard/comunidad/ComunidadLayout";
import { ComunidadCategoriaTabs } from "@/components/dashboard/comunidad/ComunidadCategoriaTabs";
import { ComunidadPostCard } from "@/components/dashboard/comunidad/ComunidadPostCard";
import { ComunidadRespuestaItem } from "@/components/dashboard/comunidad/ComunidadRespuestaItem";
import { ComunidadRespuestaComposer } from "@/components/dashboard/comunidad/ComunidadRespuestaComposer";
import { ComunidadVolverBoton } from "@/components/dashboard/comunidad/ComunidadVolverBoton";
import type { ComunidadPostDetalle } from "@/lib/comunidad-tipos";

export function ComunidadPostDetalleContent({
  post,
  usuarioActualId,
  esAdmin,
}: {
  post: ComunidadPostDetalle;
  usuarioActualId: string;
  esAdmin: boolean;
}) {
  const ruta = `/dashboard/comunidad/${post.slug}`;

  return (
    <ComunidadLayout nav={<ComunidadCategoriaTabs sinActivo />} ocultarNavEnMovil>
      <div className="flex flex-col gap-5">
        <ComunidadVolverBoton />

        <ComunidadPostCard post={post} ruta={ruta} usuarioActualId={usuarioActualId} esAdmin={esAdmin} truncar={false} />

        <div className="flex flex-col gap-1 rounded-uva-md border border-uva-divider bg-uva-surface px-4">
          <ComunidadRespuestaComposer postId={post.id} ruta={ruta} />
          {post.respuestas.length > 0 && (
            <div className="divide-y divide-uva-divider">
              {post.respuestas.map((respuesta) => (
                <ComunidadRespuestaItem
                  key={respuesta.id}
                  respuesta={respuesta}
                  ruta={ruta}
                  usuarioActualId={usuarioActualId}
                  esAdmin={esAdmin}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </ComunidadLayout>
  );
}
