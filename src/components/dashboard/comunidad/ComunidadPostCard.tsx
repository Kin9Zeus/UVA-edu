"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ExternalLink,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Pin,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  ICONO_CATEGORIA,
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

// Mismo criterio que MenuCuentaPanel: los ítems del menú con los tokens del
// sistema, no los `accent` de shadcn.
const ITEM_MENU =
  "text-uva-detalle text-uva-text hover:bg-uva-hover hover:text-uva-text focus:bg-uva-hover focus:text-uva-text";

/** Botón de texto de la barra inferior de la tarjeta ("N respuestas"). */
const CLASE_ACCION_TARJETA =
  "inline-flex min-h-11 items-center gap-2 rounded-uva-sm px-2.5 font-bold whitespace-nowrap text-uva-text-muted hover:bg-uva-hover hover:text-uva-text sm:pointer-fine:min-h-9";

/**
 * Tarjeta de una publicación. `truncar`: el feed corta el contenido a 3
 * líneas, muestra la primera imagen y enlaza al detalle; el detalle la
 * muestra completa, con todos sus adjuntos y sin enlace.
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
  const [dialogoModeracionAbierto, setDialogoModeracionAbierto] =
    useState(false);
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

  // En el feed (`truncar`) no se pintan los adjuntos reales dentro del
  // recorte de 3 líneas — uno de ancho completo metido en un `line-clamp`
  // se ve roto. Las imágenes se sacan del texto y la primera va debajo,
  // como portada; los archivos dejan un texto corto en su lugar. La
  // versión completa solo se ve al entrar al detalle.
  const adjuntosPorId = new Map(
    post.adjuntos.map((adjunto) => [adjunto.id, adjunto]),
  );
  function resolverAdjunto(id: string) {
    const adjunto = adjuntosPorId.get(id);
    if (!adjunto) return null;
    if (!truncar) return <ComunidadAdjuntoVista adjunto={adjunto} />;
    return <span className="text-uva-text-muted">📎 {adjunto.nombre}</span>;
  }
  const portada = truncar
    ? post.adjuntos.find((adjunto) => adjunto.tipo === "imagen")
    : undefined;
  // Las líneas de marcador de imagen se quitan del texto del feed: aunque se
  // pinten vacías, `line-clamp` las cuenta y ponía "…" en un texto completo.
  const contenido = truncar
    ? post.contenido
        .split("\n")
        .filter((linea) => adjuntosPorId.get(/^\[\[adjunto:([^\]]+)\]\]$/.exec(linea)?.[1] ?? "")?.tipo !== "imagen")
        .join("\n")
    : post.contenido;

  // `wrap-break-word` (título y contenido): una palabra larga sin espacios
  // que no sea URL — los enlaces ya traen `break-all` — desbordaba la tarjeta.
  const Titulo = truncar ? (
    <Link
      href={`/dashboard/comunidad/${post.slug}`}
      // En táctil el área sube a 44 px con relleno y margen negativo: el
      // título no se mueve, solo crece la zona que responde al dedo.
      className="text-uva-titulo-4 font-bold wrap-break-word text-uva-text hover:underline pointer-coarse:-my-2.5 pointer-coarse:py-2.5"
    >
      {post.titulo}
    </Link>
  ) : (
    <h1 className="text-uva-titulo-4 wrap-break-word text-uva-text">
      {post.titulo}
    </h1>
  );

  const IconoCategoria = ICONO_CATEGORIA[post.categoria];
  const respuestas = `${post.totalRespuestas} respuesta${post.totalRespuestas === 1 ? "" : "s"}`;

  return (
    // Tarjeta en el feed y en el detalle: cada publicación es un objeto con
    // su autor, su portada y su barra de acciones. El fijado del feed no
    // llega acá — va como franja (ComunidadFijadoFranja); en el detalle sí,
    // con su marca de "Fijado".
    <article
      className={cn(
        "flex flex-col gap-3 rounded-uva-md border px-4 pt-4 pb-1 sm:px-5 sm:pt-5",
        post.fijado
          ? "border-uva-accent/50 bg-[color-mix(in_srgb,var(--uva-accent)_7%,var(--uva-surface))]"
          : "border-uva-divider bg-uva-surface",
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar className="size-10 shrink-0 bg-uva-divider">
          {post.autorFotoUrl && <AvatarImage src={post.autorFotoUrl} alt="" />}
          <AvatarFallback className="bg-uva-divider text-uva-detalle font-bold text-uva-text">
            {iniciales(post.autorNombre)}
          </AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-uva-detalle font-bold text-uva-text">
            {post.autorNombre}
          </span>
          <span className="text-uva-detalle text-uva-text-muted">{post.tiempo}</span>
        </div>
        {post.fijado && !truncar && (
          <span className="inline-flex items-center gap-1 rounded-full bg-uva-accent-soft px-2 py-0.5 text-uva-detalle font-semibold text-uva-accent-text">
            <Pin className="size-3" strokeWidth={2.4} aria-hidden="true" />
            Fijado
          </span>
        )}
        {hayAcciones && !editando && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Más acciones"
              className="-mr-2 grid size-11 shrink-0 cursor-pointer place-items-center rounded-uva-sm text-uva-text-muted hover:bg-uva-hover hover:text-uva-text focus-visible:outline-2 focus-visible:outline-uva-accent sm:pointer-fine:size-9"
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              {esAdmin && (
                <DropdownMenuItem
                  className={ITEM_MENU}
                  disabled={pendienteFijar}
                  onClick={alternarFijado}
                >
                  {post.fijado ? "Desfijar" : "Fijar"}
                </DropdownMenuItem>
              )}
              {puedeEditar && (
                <DropdownMenuItem className={ITEM_MENU} onClick={() => setEditando(true)}>
                  Editar
                </DropdownMenuItem>
              )}
              {puedeEliminar && (
                <DropdownMenuItem className={ITEM_MENU} onClick={pedirEliminar}>
                  Eliminar
                </DropdownMenuItem>
              )}
              {puedeReportar && (
                <DropdownMenuItem
                  className={ITEM_MENU}
                  onClick={() => setDialogoReporteAbierto(true)}
                >
                  Reportar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <span className="inline-flex h-7 w-fit items-center gap-1.5 rounded-full bg-uva-divider px-2.5 text-uva-detalle font-semibold text-uva-text">
        <IconoCategoria
          className="size-4 text-uva-accent-2-text"
          aria-hidden="true"
        />
        {CATEGORIA_LABEL[post.categoria]}
      </span>

      {editando ? (
        <div className="pb-3">
          <ComunidadPostEditor
            post={post}
            ruta={ruta}
            onCancelar={() => setEditando(false)}
            onGuardado={() => {
              setEditando(false);
              router.refresh();
            }}
          />
        </div>
      ) : (
        <>
          {Titulo}
          {post.datosEmpleo && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-uva-detalle text-uva-text-muted">
              <span className="inline-flex items-center gap-1.5">
                <Building2
                  className="size-3.5 shrink-0 text-uva-text-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {post.datosEmpleo.empresa}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin
                  className="size-3.5 shrink-0 text-uva-text-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
                {MODALIDAD_LABEL[post.datosEmpleo.modalidad]}
                {post.datosEmpleo.ubicacion &&
                  `, ${post.datosEmpleo.ubicacion}`}
              </span>
              <a
                href={post.datosEmpleo.enlace}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-uva-accent-text hover:underline pointer-coarse:-my-3 pointer-coarse:py-3"
              >
                Postularme
                <ExternalLink className="size-3.5" strokeWidth={2.2} aria-hidden="true" />
                <span className="sr-only">(se abre en otra pestaña)</span>
              </a>
            </div>
          )}
          {/* renderizarTextoFormateado devuelve un bloque (p/ul/ol/pre) por
              línea. En el feed se dejan como bloques: `line-clamp-3` cuenta
              las líneas de todos ellos y corta en la tercera. Antes se
              forzaban a `inline` y cada salto de línea desaparecía — "para la
              casa" + "INK: Empresa…" se leía "casaINK: Empresa…". */}
          <div
            className={`text-uva-cuerpo wrap-break-word text-uva-text ${truncar ? "line-clamp-3" : "flex flex-col gap-2"}`}
          >
            {renderizarTextoFormateado(contenido, resolverAdjunto)}
          </div>

          {portada?.tipo === "imagen" && (
            // URL firmada de corta duración (src/lib/comunidad.ts): mismo
            // motivo que ComunidadAdjuntoVista para no usar next/image. Acá
            // sí se recorta (`object-cover`): es una portada, la imagen
            // completa está en el detalle.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portada.url}
              alt={`Imagen adjunta: ${portada.nombre}`}
              width={portada.ancho}
              height={portada.alto}
              loading="lazy"
              className="aspect-[16/10] h-auto max-h-80 w-full rounded-uva-sm border border-uva-divider object-cover"
            />
          )}

          <div className="-mx-2 flex flex-wrap items-center gap-x-1 border-t border-uva-divider pt-1 text-uva-detalle sm:-mx-3">
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
                className={CLASE_ACCION_TARJETA}
              >
                <MessageCircle className="size-[18px]" aria-hidden="true" />
                {respuestas}
              </Link>
            ) : (
              <span className="inline-flex min-h-11 items-center gap-2 px-2.5 font-bold text-uva-text-muted sm:pointer-fine:min-h-9">
                <MessageCircle className="size-[18px]" aria-hidden="true" />
                {respuestas}
              </span>
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
