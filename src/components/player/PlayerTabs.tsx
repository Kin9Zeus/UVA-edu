"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, Loader2, BadgeCheck } from "lucide-react";
import { extensionArchivo, formatTamanoArchivo } from "@/lib/admin/format";
import { obtenerUrlRecurso } from "@/actions/cursos/recurso";
import { crearComentario } from "@/actions/comentarios/crear";
import { eliminarComentario } from "@/actions/comentarios/eliminar";
import { darLikeComentario, quitarLikeComentario } from "@/actions/comentarios/like";
import type { RecursoLeccion } from "@/lib/leccion";
import type { ComentarioConRespuestas } from "@/lib/comentarios";

export type TabPlayer = "recursos" | "resumen" | "comentarios";

const TAB_BASE =
  "flex cursor-pointer items-center gap-[7px] rounded-full border-0 px-4 py-[9px] text-[13px] font-semibold";

export function TabsHeader({
  tab,
  onTab,
  totalRecursos,
  totalComentarios,
}: {
  tab: TabPlayer;
  onTab: (tab: TabPlayer) => void;
  totalRecursos: number;
  totalComentarios: number;
}) {
  const clase = (activo: boolean) =>
    `${TAB_BASE} ${activo ? "bg-uva-accent text-uva-text" : "bg-transparent text-uva-muted"}`;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-uva-divider pb-3.5">
      <button type="button" onClick={() => onTab("recursos")} className={clase(tab === "recursos")}>
        Recursos
        <span className="font-mono text-[11px] opacity-65">{totalRecursos}</span>
      </button>
      <button type="button" onClick={() => onTab("resumen")} className={clase(tab === "resumen")}>
        Resumen
        <span className="font-mono text-[11px] opacity-65" />
      </button>
      <button
        type="button"
        onClick={() => onTab("comentarios")}
        className={clase(tab === "comentarios")}
      >
        Comentarios
        <span className="font-mono text-[11px] opacity-65">{totalComentarios}</span>
      </button>
    </div>
  );
}

export function RecursosTab({ recursos }: { recursos: RecursoLeccion[] }) {
  // Id del recurso que está pidiendo su URL firmada ahora mismo (P1-1,
  // AUDIT-2026-08-26.md): antes el href apuntaba directo a la ruta del
  // bucket privado y siempre daba 404. Ahora cada clic pide un enlace de
  // un solo uso recién firmado, después de que RLS confirme el acceso.
  const [descargando, setDescargando] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function descargar(recurso: RecursoLeccion) {
    setErrorId(null);
    setDescargando(recurso.id);
    const resultado = await obtenerUrlRecurso(recurso.id);
    setDescargando(null);
    if ("error" in resultado) {
      setErrorId(recurso.id);
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-3">
      {recursos.length === 0 ? (
        <div className="rounded-uva-md bg-[#27272A] px-[13px] py-[11px] text-[13px] text-uva-muted">
          Esta clase todavía no tiene recursos descargables.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {recursos.map((recurso) => (
            <button
              key={recurso.id}
              type="button"
              onClick={() => descargar(recurso)}
              disabled={descargando === recurso.id}
              className="flex w-full cursor-pointer items-center gap-[11px] rounded-uva-md border-0 bg-[#27272A] px-[13px] py-[11px] text-left disabled:cursor-wait disabled:opacity-70"
            >
              <span className="inline-flex items-center rounded-uva-xs bg-[#27272A] px-2.5 py-[3px] font-mono text-[11px] font-semibold tracking-[0.02em] text-uva-muted">
                {extensionArchivo(recurso.nombre)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold text-uva-text">
                  {recurso.nombre}
                </div>
                <div className="text-[11px] text-uva-muted">
                  {errorId === recurso.id
                    ? "No pudimos generar el enlace. Intenta de nuevo."
                    : formatTamanoArchivo(recurso.tamanoBytes)}
                </div>
              </div>
              {descargando === recurso.id ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-uva-muted" strokeWidth={2.75} />
              ) : (
                <Download className="size-4 shrink-0 text-uva-muted" strokeWidth={2.75} />
              )}
            </button>
          ))}
        </div>
      )}
      <p className="m-0 text-[11.5px] text-uva-muted">
        Incluidos en tu plan. Se actualizan cuando el instructor revisa precios.
      </p>
    </div>
  );
}

export function ResumenTab({ resumen }: { resumen: string | null }) {
  const parrafos = (resumen ?? "")
    .split(/\n{2,}/)
    .map((parrafo) => parrafo.trim())
    .filter(Boolean);

  if (parrafos.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="m-0 max-w-[640px] text-[13.5px] text-uva-muted">
          El instructor todavía no publicó el resumen de esta clase.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {parrafos.map((parrafo, i) => (
        <p key={i} className="m-0 max-w-[640px] text-[13.5px] leading-relaxed text-uva-muted">
          {parrafo}
        </p>
      ))}
    </div>
  );
}

/** Cuenta raíces + respuestas, para el número junto a la pestaña "Comentarios". */
export function contarComentarios(comentarios: ComentarioConRespuestas[]): number {
  return comentarios.reduce((total, comentario) => total + 1 + comentario.respuestas.length, 0);
}

type OrdenComentarios = "relevantes" | "recientes" | "antiguos";

const ORDEN_LABEL: Record<OrdenComentarios, string> = {
  relevantes: "Más relevantes",
  recientes: "Más recientes",
  antiguos: "Más antiguos",
};

/**
 * Ordena solo los comentarios raíz — las respuestas se quedan en su orden
 * cronológico de siempre (son un hilo de conversación, no un ranking
 * propio). El servidor ya entrega `comentarios` de más antiguo a más
 * reciente (getComentariosDeLeccion, ORDER BY creado_en asc), así que
 * "antiguos" es simplemente ese orden sin tocar y "recientes" es
 * invertirlo. `Array.prototype.sort` es estable (ES2019): al ordenar por
 * likes con ese mismo array de entrada, un empate en likes se desempata
 * por el más antiguo primero, sin necesitar guardar el timestamp crudo.
 */
function ordenarComentarios(
  comentarios: ComentarioConRespuestas[],
  orden: OrdenComentarios,
): ComentarioConRespuestas[] {
  const copia = [...comentarios];
  if (orden === "relevantes") return copia.sort((a, b) => b.likes - a.likes);
  if (orden === "recientes") return copia.reverse();
  return copia;
}

export function ComentariosTab({
  cursoId,
  leccionId,
  comentarios,
  puedeComentar,
  usuarioActualId,
  esAdmin,
  onCambio,
}: {
  cursoId: string;
  leccionId: string;
  comentarios: ComentarioConRespuestas[];
  puedeComentar: boolean;
  usuarioActualId: string | null;
  esAdmin: boolean;
  /** El árbol vive en el servidor (RSC) — tras publicar/borrar/dar like se
   * refresca con `router.refresh()`, avisado acá en vez de duplicar estado. */
  onCambio: () => void;
}) {
  const total = contarComentarios(comentarios);
  const [orden, setOrden] = useState<OrdenComentarios>("recientes");
  const comentariosOrdenados = useMemo(
    () => ordenarComentarios(comentarios, orden),
    [comentarios, orden],
  );

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <span className="text-[12.5px] text-uva-muted">
          {total === 0
            ? "Sé el primero en comentar esta clase"
            : `${total} ${total === 1 ? "comentario" : "comentarios"} en esta clase`}
        </span>
        {comentarios.length > 1 && (
          <select
            aria-label="Ordenar comentarios"
            value={orden}
            onChange={(event) => setOrden(event.target.value as OrdenComentarios)}
            className="ml-auto cursor-pointer rounded-uva-md border border-uva-divider bg-uva-surface px-2 py-1 text-[12px] text-uva-muted outline-none hover:text-uva-text focus-visible:border-uva-accent"
          >
            {(Object.keys(ORDEN_LABEL) as OrdenComentarios[]).map((valor) => (
              <option key={valor} value={valor}>
                {ORDEN_LABEL[valor]}
              </option>
            ))}
          </select>
        )}
      </div>

      {puedeComentar ? (
        <NuevoComentarioForm cursoId={cursoId} leccionId={leccionId} onPublicado={onCambio} />
      ) : (
        <p className="m-0 text-[12.5px] text-uva-muted">
          Inicia sesión para comentar en esta clase.
        </p>
      )}

      <div className="h-px bg-uva-divider" />

      <div className="flex flex-col gap-[18px]">
        {comentariosOrdenados.map((comentario) => (
          <ComentarioItem
            key={comentario.id}
            cursoId={cursoId}
            leccionId={leccionId}
            comentario={comentario}
            puedeComentar={puedeComentar}
            usuarioActualId={usuarioActualId}
            esAdmin={esAdmin}
            onCambio={onCambio}
          />
        ))}
      </div>
    </div>
  );
}

function NuevoComentarioForm({
  cursoId,
  leccionId,
  idComentarioPadre = null,
  onPublicado,
  onCancelar,
  autoFocus = false,
}: {
  cursoId: string;
  leccionId: string;
  idComentarioPadre?: string | null;
  onPublicado: () => void;
  onCancelar?: () => void;
  autoFocus?: boolean;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  function enviar() {
    if (!texto.trim()) return;
    setError(null);
    startTransition(async () => {
      const resultado = await crearComentario(cursoId, leccionId, texto, idComentarioPadre);
      if ("error" in resultado) {
        setError(resultado.error);
        return;
      }
      setTexto("");
      onPublicado();
      onCancelar?.();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="m-0 text-[12px] text-uva-error-text">{error}</p>}
      <textarea
        autoFocus={autoFocus}
        value={texto}
        onChange={(event) => setTexto(event.target.value)}
        placeholder={
          idComentarioPadre ? "Escribe tu respuesta…" : "Escribe tu duda o aporta a la clase…"
        }
        className="min-h-[74px] w-full resize-y rounded-uva-md border border-uva-divider bg-uva-surface px-2.5 py-1.5 text-sm text-uva-text caret-uva-accent outline-none placeholder:text-uva-text-faint hover:border-uva-text/45 focus-visible:border-uva-accent"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={pendiente || !texto.trim()}
          onClick={enviar}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-uva-md border border-transparent bg-uva-accent px-[15.84px] py-[8.8px] text-[12px] font-semibold text-white hover:bg-uva-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendiente ? "Publicando…" : idComentarioPadre ? "Responder" : "Comentar"}
        </button>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="inline-flex cursor-pointer items-center rounded-uva-md border border-uva-divider bg-transparent px-[15.84px] py-[8.8px] text-[12px] font-semibold text-uva-text hover:bg-[#27272A]"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function ComentarioItem({
  cursoId,
  leccionId,
  comentario,
  puedeComentar,
  usuarioActualId,
  esAdmin,
  onCambio,
  esRespuesta = false,
}: {
  cursoId: string;
  leccionId: string;
  comentario: ComentarioConRespuestas;
  puedeComentar: boolean;
  usuarioActualId: string | null;
  esAdmin: boolean;
  onCambio: () => void;
  esRespuesta?: boolean;
}) {
  const [respondiendo, setRespondiendo] = useState(false);
  const [verRespuestas, setVerRespuestas] = useState(false);
  const [likeOptimista, setLikeOptimista] = useState<{ meGusta: boolean; likes: number } | null>(
    null,
  );
  const [pendienteLike, startTransitionLike] = useTransition();
  const [pendienteBorrar, startTransitionBorrar] = useTransition();

  const meGusta = likeOptimista?.meGusta ?? comentario.meGusta;
  const likes = likeOptimista?.likes ?? comentario.likes;
  const puedeBorrar = !comentario.eliminado && (esAdmin || comentario.autorId === usuarioActualId);

  function toggleLike() {
    if (!usuarioActualId) return;
    const siguiente = { meGusta: !meGusta, likes: meGusta ? likes - 1 : likes + 1 };
    setLikeOptimista(siguiente);
    startTransitionLike(async () => {
      const resultado = siguiente.meGusta
        ? await darLikeComentario(cursoId, leccionId, comentario.id)
        : await quitarLikeComentario(cursoId, leccionId, comentario.id);
      if ("error" in resultado) {
        setLikeOptimista({ meGusta, likes });
        return;
      }
      onCambio();
    });
  }

  function borrar() {
    startTransitionBorrar(async () => {
      await eliminarComentario(cursoId, leccionId, comentario.id);
      onCambio();
    });
  }

  return (
    <div className="flex gap-[11px]">
      <div className="size-8 shrink-0 overflow-hidden rounded-full">
        <div className="grid size-full place-items-center bg-[#27272A] text-[12px] font-semibold tracking-[0.02em] text-uva-muted">
          {comentario.iniciales}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-[7px]">
          <span className="text-[13px] font-bold text-uva-text">
            {comentario.autor}
            {comentario.bandera && (
              <span aria-hidden className="ml-1">
                {comentario.bandera}
              </span>
            )}
          </span>
          {comentario.esInstructor ? (
            <span className="inline-flex items-center gap-1 rounded-uva-xs bg-uva-accent-2-soft px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] text-uva-accent-2-text">
              <BadgeCheck className="size-3" strokeWidth={2.4} />
              Profesor
            </span>
          ) : (
            <span className="inline-flex items-center rounded-uva-xs bg-[#27272A] px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] text-uva-muted">
              Alumno
            </span>
          )}
          <span className="text-[11px] text-uva-text opacity-45">{comentario.tiempo}</span>
        </div>
        <p
          className={`mt-[5px] mb-[7px] text-[13px] ${comentario.eliminado ? "text-uva-text-faint italic" : "text-uva-text opacity-80"}`}
        >
          {comentario.texto}
        </p>
        <div className="flex flex-wrap gap-3.5 text-[12px] text-uva-text opacity-60">
          <button
            type="button"
            disabled={!usuarioActualId || pendienteLike}
            onClick={toggleLike}
            className={`cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed ${meGusta ? "font-semibold text-uva-accent opacity-100" : ""}`}
          >
            ♥ {likes}
          </button>
          {!esRespuesta && puedeComentar && !comentario.eliminado && (
            <button
              type="button"
              onClick={() => setRespondiendo((valor) => !valor)}
              className="cursor-pointer border-0 bg-transparent p-0"
            >
              Responder
            </button>
          )}
          {!esRespuesta && comentario.respuestas.length > 0 && (
            <button
              type="button"
              onClick={() => setVerRespuestas((valor) => !valor)}
              className="cursor-pointer border-0 bg-transparent p-0"
            >
              {verRespuestas ? "Ocultar" : "Ver"} {comentario.respuestas.length}{" "}
              {comentario.respuestas.length === 1 ? "respuesta" : "respuestas"}
            </button>
          )}
          {puedeBorrar && (
            <button
              type="button"
              disabled={pendienteBorrar}
              onClick={borrar}
              className="cursor-pointer border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Eliminar
            </button>
          )}
        </div>

        {respondiendo && (
          <div className="mt-2.5">
            <NuevoComentarioForm
              cursoId={cursoId}
              leccionId={leccionId}
              idComentarioPadre={comentario.id}
              onPublicado={() => setVerRespuestas(true)}
              onCancelar={() => setRespondiendo(false)}
              autoFocus
            />
          </div>
        )}

        {verRespuestas && comentario.respuestas.length > 0 && (
          <div className="mt-3.5 flex flex-col gap-3.5 border-l border-uva-divider pl-3.5">
            {comentario.respuestas.map((respuesta) => (
              <ComentarioItem
                key={respuesta.id}
                cursoId={cursoId}
                leccionId={leccionId}
                comentario={respuesta}
                puedeComentar={puedeComentar}
                usuarioActualId={usuarioActualId}
                esAdmin={esAdmin}
                onCambio={onCambio}
                esRespuesta
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
