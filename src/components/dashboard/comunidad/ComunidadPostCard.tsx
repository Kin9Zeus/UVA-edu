"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pin } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ComunidadReactionButton } from "@/components/dashboard/comunidad/ComunidadReactionButton";
import { ComunidadAdjuntoVista } from "@/components/dashboard/comunidad/ComunidadAdjuntoVista";
import { ComunidadPostEditor } from "@/components/dashboard/comunidad/ComunidadPostEditor";
import { eliminarPostComunidad } from "@/actions/comunidad/eliminar";
import { fijarPostComunidad } from "@/actions/comunidad/fijar";
import { renderizarTextoFormateado } from "@/lib/formato-texto";
import {
  CATEGORIA_LABEL,
  CATEGORIA_ESTILO,
  CLASE_BOTON_ACCION_COMUNIDAD,
  type ComunidadPostResumen,
} from "@/lib/comunidad-tipos";
import { cn } from "@/lib/utils";

function iniciales(nombre: string) {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

/**
 * Tarjeta de una publicación. `truncar`: el feed corta el contenido a 3
 * líneas y enlaza al detalle; el detalle la muestra completa y sin enlace.
 */
export function ComunidadPostCard({
  post,
  ruta,
  usuarioActualId,
  esAdmin,
  truncar,
}: {
  post: ComunidadPostResumen;
  ruta: string;
  usuarioActualId: string | null;
  esAdmin: boolean;
  truncar: boolean;
}) {
  const router = useRouter();
  const [pendienteFijar, startTransitionFijar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);

  const puedeEliminar = usuarioActualId === post.autorId || esAdmin;
  const puedeEditar = !truncar && usuarioActualId === post.autorId;
  const hayAcciones = esAdmin || puedeEditar || puedeEliminar;

  // Se espera a que termine: ConfirmDialog muestra "Procesando…" mientras la
  // promesa siga abierta y solo se cierra al resolverse.
  async function eliminar() {
    await eliminarPostComunidad(post.id, ruta);
    router.refresh();
  }

  function alternarFijado() {
    startTransitionFijar(async () => {
      await fijarPostComunidad(post.id, !post.fijado, ruta);
      router.refresh();
    });
  }

  // En el feed truncado (`truncar`) no se pintan las imágenes/archivos
  // reales dentro del recorte de 3 líneas — un adjunto de ancho completo
  // metido en un `line-clamp` se ve roto. Se muestra en su lugar un texto
  // corto en el mismo punto donde el autor lo puso, y la versión completa
  // (con la imagen real) solo se ve al entrar al detalle.
  const adjuntosPorId = new Map(post.adjuntos.map((adjunto) => [adjunto.id, adjunto]));
  function resolverAdjunto(id: string) {
    const adjunto = adjuntosPorId.get(id);
    if (!adjunto) return null;
    if (!truncar) return <ComunidadAdjuntoVista adjunto={adjunto} />;
    return <span className="text-uva-text-faint">📎 {adjunto.nombre}</span>;
  }

  // `wrap-break-word` (título y contenido): una palabra larga sin espacios
  // que no sea URL — los enlaces ya traen `break-all` — desbordaba la tarjeta.
  const Titulo = truncar ? (
    <Link
      href={`/dashboard/comunidad/${post.slug}`}
      className="font-heading text-base wrap-break-word text-uva-text hover:underline"
    >
      {post.titulo}
    </Link>
  ) : (
    <h1 className="font-heading text-xl wrap-break-word text-uva-text">{post.titulo}</h1>
  );

  return (
    <article
      className={`flex flex-col gap-3 rounded-uva-md border border-uva-divider p-4 ${post.fijado ? "bg-[#141417]" : "bg-uva-surface"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex h-5 w-fit items-center rounded-4xl px-2 text-xs font-semibold",
            CATEGORIA_ESTILO[post.categoria],
          )}
        >
          {CATEGORIA_LABEL[post.categoria]}
        </span>
        {post.fijado && (
          <span className="inline-flex items-center gap-1 text-xs text-uva-text-faint">
            <Pin className="size-3" strokeWidth={2} />
            Fijado
          </span>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        <Avatar className="size-8 shrink-0 bg-uva-divider">
          <AvatarFallback className="bg-uva-divider text-xs text-uva-text">
            {iniciales(post.autorNombre)}
          </AvatarFallback>
        </Avatar>
        {/* La causa real del desalineado no era la altura de línea: `<p>`
            trae un margin-bottom de 14px (~1em) que no queda reseteado en
            este proyecto, y ese margen SÍ cuenta para el centrado de un
            flex item — `m-0` lo confirma (medido con getBoundingClientRect
            contra el avatar: diferencia de 0px). `leading-8` iguala la
            altura de línea a la del avatar (`size-8`, 32px). */}
        <p className="m-0 min-w-0 flex-1 truncate text-sm leading-8 text-uva-text">{post.autorNombre}</p>
      </div>

      {editando ? (
        <ComunidadPostEditor
          post={post}
          ruta={ruta}
          onCancelar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            router.refresh();
          }}
        />
      ) : (
        <>
          {Titulo}
          {/* renderizarTextoFormateado devuelve un bloque (p/ul/ol/pre) por
              línea. En el feed se dejan como bloques: `line-clamp-3` cuenta
              las líneas de todos ellos y corta en la tercera. Antes se
              forzaban a `inline` y cada salto de línea desaparecía — "para la
              casa" + "INK: Empresa…" se leía "casaINK: Empresa…". */}
          <div
            className={`text-sm wrap-break-word text-uva-text-muted ${truncar ? "line-clamp-3" : "flex flex-col gap-2"}`}
          >
            {renderizarTextoFormateado(post.contenido, resolverAdjunto)}
          </div>

          {/* `flex-wrap` + `whitespace-nowrap`: en una fila rígida, a 375 px
              (admin y autora, en el detalle) "hace 3 horas" quedaba en 32 px
              de ancho y 3 líneas. Ahora lo que no cabe baja entero a la
              línea siguiente, y las acciones van juntas a la derecha. */}
          <div className="flex flex-wrap items-center gap-x-4 text-xs text-uva-text-faint">
            <span className="whitespace-nowrap">{post.tiempo}</span>
            <ComunidadReactionButton
              tipo="post"
              objetivoId={post.id}
              ruta={ruta}
              meReaccione={post.meReaccione}
              totalReacciones={post.totalReacciones}
              usuarioActualId={usuarioActualId}
            />
            {truncar ? (
              <Link
                href={`/dashboard/comunidad/${post.slug}`}
                className={cn(CLASE_BOTON_ACCION_COMUNIDAD, "whitespace-nowrap")}
              >
                {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
              </Link>
            ) : (
              <span className="whitespace-nowrap">
                {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
              </span>
            )}
            {hayAcciones && (
              <div className="ml-auto flex items-center gap-4">
                {esAdmin && (
                  <button
                    type="button"
                    disabled={pendienteFijar}
                    onClick={alternarFijado}
                    className={CLASE_BOTON_ACCION_COMUNIDAD}
                  >
                    {post.fijado ? "Desfijar" : "Fijar"}
                  </button>
                )}
                {puedeEditar && (
                  <button type="button" onClick={() => setEditando(true)} className={CLASE_BOTON_ACCION_COMUNIDAD}>
                    Editar
                  </button>
                )}
                {puedeEliminar && (
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminar(true)}
                    className={CLASE_BOTON_ACCION_COMUNIDAD}
                  >
                    Eliminar
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Antes borraba al primer toque; en móvil queda al lado del ❤ y era
          fácil tocarlo sin querer. */}
      {puedeEliminar && (
        <ConfirmDialog
          open={confirmandoEliminar}
          onOpenChange={setConfirmandoEliminar}
          title="Eliminar publicación"
          description="La publicación dejará de verse en la comunidad. Esta acción no se puede deshacer."
          onConfirm={eliminar}
        />
      )}
    </article>
  );
}
