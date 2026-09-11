"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ComunidadReactionButton } from "@/components/dashboard/comunidad/ComunidadReactionButton";
import { ComunidadAdjuntoVista } from "@/components/dashboard/comunidad/ComunidadAdjuntoVista";
import { ComunidadPostEditor } from "@/components/dashboard/comunidad/ComunidadPostEditor";
import { ModerarComunidadDialog } from "@/components/dashboard/comunidad/ModerarComunidadDialog";
import { ReportarComunidadDialog } from "@/components/dashboard/comunidad/ReportarComunidadDialog";
import { eliminarPostComunidad } from "@/actions/comunidad/eliminar";
import { reportarComunidad } from "@/actions/comunidad/reportar";
import { fijarPostComunidad } from "@/actions/comunidad/fijar";
import { renderizarTextoFormateado } from "@/lib/formato-texto";
import { CATEGORIA_LABEL, CATEGORIA_ESTILO, type ComunidadPostResumen } from "@/lib/comunidad-tipos";
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
  const [pendienteEliminar, startTransitionEliminar] = useTransition();
  const [pendienteFijar, startTransitionFijar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [dialogoModeracionAbierto, setDialogoModeracionAbierto] = useState(false);
  const [dialogoReporteAbierto, setDialogoReporteAbierto] = useState(false);

  const esAutor = usuarioActualId === post.autorId;
  const puedeEliminar = esAutor || esAdmin;
  const puedeEditar = esAutor;
  // Un admin ya puede eliminar directo (con motivo) — reportar es la vía
  // para el resto, que no tiene ninguna otra forma de escalar algo.
  const puedeReportar = Boolean(usuarioActualId) && !esAutor && !esAdmin;

  async function confirmarReporte(motivo: string) {
    const resultado = await reportarComunidad({ idPost: post.id }, motivo);
    if ("error" in resultado) return { error: resultado.error };
    return {};
  }

  function irAlCerrarTrasEliminar() {
    // En el detalle (truncar=false) la propia publicación deja de existir:
    // un refresh volvería a pedirla y el server component respondería 404.
    // En el feed (truncar=true), en cambio, sí hace falta el refresh para
    // que la tarjeta desaparezca de la lista.
    if (truncar) {
      router.refresh();
    } else {
      router.push("/dashboard/comunidad");
    }
  }

  // El propio autor borra en un clic, sin motivo. Un admin moderando
  // contenido AJENO tiene que justificarlo primero (ModerarComunidadDialog),
  // porque ese motivo se le envía al autor por correo.
  function eliminar() {
    if (!esAutor) {
      setDialogoModeracionAbierto(true);
      return;
    }
    startTransitionEliminar(async () => {
      await eliminarPostComunidad(post.id, ruta);
      irAlCerrarTrasEliminar();
    });
  }

  async function confirmarEliminacionModerada(motivo: string) {
    const resultado = await eliminarPostComunidad(post.id, ruta, motivo);
    if ("error" in resultado) return { error: resultado.error };
    irAlCerrarTrasEliminar();
    return {};
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

  const Titulo = truncar ? (
    <Link href={`/dashboard/comunidad/${post.id}`} className="font-heading text-base text-uva-text hover:underline">
      {post.titulo}
    </Link>
  ) : (
    <h1 className="font-heading text-xl text-uva-text">{post.titulo}</h1>
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
          {post.autorFotoUrl && <AvatarImage src={post.autorFotoUrl} alt="" />}
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
          {/* renderizarTextoFormateado devuelve bloques (p/ul/ol/pre) reales,
              no texto plano — en la vista truncada del feed se fuerzan a
              inline para que `line-clamp-3` los recorte como si fuera un
              párrafo. */}
          <div
            className={`text-sm text-uva-text-muted ${truncar ? "line-clamp-3 [&>*]:inline" : "flex flex-col gap-2"}`}
          >
            {renderizarTextoFormateado(post.contenido, resolverAdjunto)}
          </div>

          <div className="flex items-center gap-4 text-xs text-uva-text-faint">
            <span>{post.tiempo}</span>
            <ComunidadReactionButton
              tipo="post"
              objetivoId={post.id}
              ruta={ruta}
              meReaccione={post.meReaccione}
              totalReacciones={post.totalReacciones}
              usuarioActualId={usuarioActualId}
            />
            {truncar ? (
              <Link href={`/dashboard/comunidad/${post.id}`} className="hover:text-uva-text-muted">
                {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
              </Link>
            ) : (
              <span>
                {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
              </span>
            )}
            {esAdmin && (
              <button
                type="button"
                disabled={pendienteFijar}
                onClick={alternarFijado}
                className="cursor-pointer border-0 bg-transparent p-0 hover:text-uva-text-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                {post.fijado ? "Desfijar" : "Fijar"}
              </button>
            )}
            {!truncar && puedeEditar && (
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="cursor-pointer border-0 bg-transparent p-0 hover:text-uva-text-muted"
              >
                Editar
              </button>
            )}
            {puedeEliminar && (
              <button
                type="button"
                disabled={pendienteEliminar}
                onClick={eliminar}
                className="cursor-pointer border-0 bg-transparent p-0 hover:text-uva-text-muted disabled:cursor-not-allowed disabled:opacity-60"
              >
                Eliminar
              </button>
            )}
            {puedeReportar && (
              <button
                type="button"
                onClick={() => setDialogoReporteAbierto(true)}
                className="cursor-pointer border-0 bg-transparent p-0 hover:text-uva-text-muted"
              >
                Reportar
              </button>
            )}
          </div>
        </>
      )}

      {!esAutor && (
        <ModerarComunidadDialog
          open={dialogoModeracionAbierto}
          onOpenChange={setDialogoModeracionAbierto}
          tipoContenido="publicación"
          onConfirm={confirmarEliminacionModerada}
        />
      )}
      {puedeReportar && (
        <ReportarComunidadDialog
          open={dialogoReporteAbierto}
          onOpenChange={setDialogoReporteAbierto}
          tipoContenido="publicación"
          onConfirm={confirmarReporte}
        />
      )}
    </article>
  );
}
