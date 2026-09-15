import { ComunidadLayout } from "@/components/dashboard/comunidad/ComunidadLayout";
import { ComunidadCategoriaTabs } from "@/components/dashboard/comunidad/ComunidadCategoriaTabs";
import { ComunidadPostCard } from "@/components/dashboard/comunidad/ComunidadPostCard";
import { ComunidadRespuestasList } from "@/components/dashboard/comunidad/ComunidadRespuestasList";
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

        {/* Sin una caja que envuelva responder + hilo. Eran dos losas grises
            apiladas —la publicación y esta— y además metían cosas de distinta
            naturaleza bajo el mismo marco: responder es un control, el hilo es
            contenido. Ahora el único marco de la pantalla es la publicación,
            que es su sujeto; el composer lleva el suyo por ser una superficie
            de escritura (igual que en el feed), y las respuestas caen sobre el
            fondo como filas, igual que la corriente del feed. */}
        <ComunidadRespuestaComposer postId={post.id} ruta={ruta} />

        {post.respuestas.length > 0 && (
          <ComunidadRespuestasList
            respuestas={post.respuestas}
            // El total lo manda el servidor y NO es `respuestas.length`:
            // `getComunidadPost` descuenta las eliminadas del total pero deja
            // sus lápidas en la lista (comunidad.ts:398). Contándolas acá, el
            // encabezado diría "4 respuestas" justo debajo de la publicación,
            // que en su fila de acciones dice "3".
            total={post.totalRespuestas}
            ruta={ruta}
            usuarioActualId={usuarioActualId}
            esAdmin={esAdmin}
          />
        )}
      </div>
    </ComunidadLayout>
  );
}
