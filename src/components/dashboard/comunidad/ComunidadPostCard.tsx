"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pin, Building2, MapPin, ExternalLink, Megaphone, PencilRuler, MessageCircleQuestion, Briefcase, Paperclip, MessageCircle } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { ComunidadReactionButton } from "@/components/dashboard/comunidad/ComunidadReactionButton";
import { ComunidadAdjuntoVista } from "@/components/dashboard/comunidad/ComunidadAdjuntoVista";
import { ComunidadPostEditor } from "@/components/dashboard/comunidad/ComunidadPostEditor";
import { ModerarComunidadDialog } from "@/components/dashboard/comunidad/ModerarComunidadDialog";
import { ReportarComunidadDialog } from "@/components/dashboard/comunidad/ReportarComunidadDialog";
import { MODALIDAD_LABEL } from "@/components/dashboard/comunidad/ComunidadCamposEmpleo";
import { eliminarPostComunidad } from "@/actions/comunidad/eliminar";
import { reportarComunidad } from "@/actions/comunidad/reportar";
import { fijarPostComunidad } from "@/actions/comunidad/fijar";
import { renderizarTextoFormateado } from "@/lib/formato-texto";
import {
  CATEGORIA_LABEL,
  CLASE_BOTON_ACCION_COMUNIDAD,
  type ComunidadPostResumen,
} from "@/lib/comunidad-tipos";
import { cn } from "@/lib/utils";

/** Ícono de cada categoría (en amarillo, al lado de su nombre). */
const ICONO_CATEGORIA = {
  ANUNCIOS: Megaphone,
  PROYECTOS: PencilRuler,
  PREGUNTAS: MessageCircleQuestion,
  EMPLEO: Briefcase,
} as const;

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
  const [dialogoModeracionAbierto, setDialogoModeracionAbierto] = useState(false);
  const [dialogoReporteAbierto, setDialogoReporteAbierto] = useState(false);

  const esAutor = usuarioActualId === post.autorId;
  const puedeEliminar = esAutor || esAdmin;
  const puedeEditar = !truncar && esAutor;
  // Un admin ya puede eliminar directo (con motivo) — reportar es la vía
  // para el resto, que no tiene ninguna otra forma de escalar algo.
  const puedeReportar = Boolean(usuarioActualId) && !esAutor && !esAdmin;
  const hayAcciones = esAdmin || puedeEditar || puedeEliminar || puedeReportar;

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

  // El autor confirma en ConfirmDialog: antes borraba al primer toque, y en
  // móvil el botón queda al lado del ❤. Un admin moderando contenido AJENO
  // tiene que justificarlo primero (ModerarComunidadDialog), porque ese
  // motivo se le envía al autor por correo.
  function pedirEliminar() {
    if (esAutor) setConfirmandoEliminar(true);
    else setDialogoModeracionAbierto(true);
  }

  // Se espera a que termine: ConfirmDialog muestra "Procesando…" mientras la
  // promesa siga abierta y solo se cierra al resolverse.
  async function eliminarPropia() {
    await eliminarPostComunidad(post.id, ruta);
    irAlCerrarTrasEliminar();
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
    return (
      <span className="inline-flex items-center gap-1.5 text-uva-detalle font-semibold text-uva-text-muted">
        <Paperclip className="size-4" aria-hidden="true" />
        {adjunto.nombre}
      </span>
    );
  }

  // `wrap-break-word` (título y contenido): una palabra larga sin espacios
  // que no sea URL — los enlaces ya traen `break-all` — desbordaba la tarjeta.
  const Titulo = truncar ? (
    <Link
      href={`/dashboard/comunidad/${post.slug}`}
      className="line-clamp-2 min-h-11 py-0.5 font-heading text-uva-cuerpo leading-snug font-extrabold tracking-[-0.015em] wrap-break-word text-uva-text hover:text-uva-accent-ink"
    >
      {post.titulo}
    </Link>
  ) : (
    <h1 className="text-uva-titulo-3 wrap-break-word text-uva-text">{post.titulo}</h1>
  );
  const IconoCategoria = ICONO_CATEGORIA[post.categoria];

  return (
    <article
      className={cn(
        "relative flex flex-col gap-2 rounded-uva-lg bg-uva-surface",
        // Cartelera (feed): cada publicación es una nota clavada, con su
        // chinche arriba al centro; la fijada lleva borde grueso y chinche
        // amarillo. El detalle es la misma ficha, sin chinche.
        truncar ? "h-full px-4 pt-[34px] pb-1.5" : "p-5",
        post.fijado ? "border-2 border-uva-text" : "border border-uva-line-strong",
      )}
    >
      {truncar && (
        <span
          aria-hidden="true"
          className={cn(
            "absolute top-2.5 left-1/2 size-3.5 -translate-x-1/2 rounded-full border-2 border-uva-text",
            post.fijado ? "bg-uva-accent-2" : "bg-uva-line-strong",
          )}
        />
      )}
      <div className="flex items-center justify-between gap-2.5">
        <span className="inline-flex items-center gap-1.5 text-uva-detalle font-semibold text-uva-text-muted">
          <IconoCategoria className="size-4 text-uva-accent-2-text" aria-hidden="true" />
          {CATEGORIA_LABEL[post.categoria]}
        </span>
        {post.fijado && (
          <span className="inline-flex min-h-6 items-center gap-1 rounded-full bg-uva-btn px-2.5 text-uva-detalle font-bold text-uva-on-accent">
            <Pin className="size-3" strokeWidth={2.4} aria-hidden="true" />
            Fijado
          </span>
        )}
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
          {post.datosEmpleo && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-uva-detalle text-uva-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                {post.datosEmpleo.empresa}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
                {MODALIDAD_LABEL[post.datosEmpleo.modalidad]}
                {post.datosEmpleo.ubicacion && `, ${post.datosEmpleo.ubicacion}`}
              </span>
              <a
                href={post.datosEmpleo.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 text-uva-cuerpo font-bold text-uva-accent-ink hover:underline"
              >
                Postularme
                <ExternalLink className="size-4" strokeWidth={2.2} aria-hidden="true" />
              </a>
            </div>
          )}
          {/* renderizarTextoFormateado devuelve un bloque (p/ul/ol/pre) por
              línea. En el feed se dejan como bloques: `line-clamp-3` cuenta
              las líneas de todos ellos y corta en la tercera. Antes se
              forzaban a `inline` y cada salto de línea desaparecía — "para la
              casa" + "INK: Empresa…" se leía "casaINK: Empresa…". */}
          <div
            className={`text-uva-cuerpo wrap-break-word text-uva-text-muted ${truncar ? "line-clamp-3" : "flex flex-col gap-2"}`}
          >
            {renderizarTextoFormateado(post.contenido, resolverAdjunto)}
          </div>

          {/* `flex-wrap` + `whitespace-nowrap`: en una fila rígida, a 375 px
              (admin y autora, en el detalle) "hace 3 horas" quedaba en 32 px
              de ancho y 3 líneas. Ahora lo que no cabe baja entero a la
              línea siguiente, y las acciones van juntas a la derecha. */}
          {/* Pie: quién y cuándo, y debajo las acciones. `mt-auto` lo baja al
              fondo de la nota para que las de una misma fila coincidan. */}
          <div className="mt-auto flex min-w-0 items-center gap-2.5 pt-1">
            <Avatar className="size-8 shrink-0 border-[1.5px] border-uva-line-strong bg-uva-surface-2">
              {post.autorFotoUrl && <AvatarImage src={post.autorFotoUrl} alt="" />}
              <AvatarFallback className="bg-uva-surface-2 text-xs font-extrabold text-uva-text">
                {iniciales(post.autorNombre)}
              </AvatarFallback>
            </Avatar>
            <p className="m-0 min-w-0 truncate text-uva-detalle font-bold text-uva-text">{post.autorNombre}</p>
            <span className="text-uva-detalle whitespace-nowrap text-uva-text-muted">{post.tiempo}</span>
          </div>
          <div className="-ml-2 flex flex-wrap items-center gap-x-0.5 text-uva-detalle">
            <ComunidadReactionButton
              tipo="post"
              objetivoId={post.id}
              ruta={ruta}
              meReaccione={post.meReaccione}
              totalReacciones={post.totalReacciones}
              usuarioActualId={usuarioActualId}
            />
            {truncar ? (
              <Link href={`/dashboard/comunidad/${post.slug}`} className={CLASE_BOTON_ACCION_COMUNIDAD}>
                <MessageCircle className="size-[18px]" aria-hidden="true" />
                {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center px-2 font-semibold whitespace-nowrap text-uva-text-muted">
                {post.totalRespuestas} respuesta{post.totalRespuestas === 1 ? "" : "s"}
              </span>
            )}
            {hayAcciones && (
              <div className="-mr-2 ml-auto flex flex-wrap items-center">
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
                  <button type="button" onClick={pedirEliminar} className={CLASE_BOTON_ACCION_COMUNIDAD}>
                    Eliminar
                  </button>
                )}
                {puedeReportar && (
                  <button
                    type="button"
                    onClick={() => setDialogoReporteAbierto(true)}
                    className={CLASE_BOTON_ACCION_COMUNIDAD}
                  >
                    Reportar
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {esAutor && (
        <ConfirmDialog
          open={confirmandoEliminar}
          onOpenChange={setConfirmandoEliminar}
          title="Eliminar publicación"
          description="La publicación dejará de verse en la comunidad. Esta acción no se puede deshacer."
          onConfirm={eliminarPropia}
        />
      )}
      {puedeEliminar && !esAutor && (
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
