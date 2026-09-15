import { ShieldAlert, Trash2 } from "lucide-react";
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

  // Llegar acá con el post ya eliminado es normal, no un error: un enlace
  // guardado, o la notificación "tu reporte fue revisado" (que apunta al
  // post reportado — 100_comunidad_notificaciones_moderacion_reportes.sql).
  // Antes esto ni siquiera llegaba a renderizarse (getComunidadPost
  // devolvía null y la página hacía notFound()) — un 404 genérico no le
  // decía a nadie qué pasó con la publicación.
  if (post.eliminado) {
    return (
      <ComunidadLayout nav={<ComunidadCategoriaTabs sinActivo />}>
        <div className="flex flex-col gap-5">
          <ComunidadVolverBoton />
          <div className="flex flex-col items-center gap-3 rounded-uva-md border border-uva-divider bg-uva-surface px-6 py-12 text-center">
            {post.eliminadoPorAdmin ? (
              <ShieldAlert className="size-8 text-uva-text-faint" strokeWidth={1.6} />
            ) : (
              <Trash2 className="size-8 text-uva-text-faint" strokeWidth={1.6} />
            )}
            <p className="text-sm text-uva-text">
              {post.eliminadoPorAdmin
                ? "Esta publicación fue eliminada por moderación."
                : "Esta publicación ya no existe — su autor la eliminó."}
            </p>
          </div>
        </div>
      </ComunidadLayout>
    );
  }

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
