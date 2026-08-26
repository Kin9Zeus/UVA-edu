"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { formatTamanoArchivo } from "@/lib/admin/format";
import { obtenerUrlRecurso } from "@/actions/cursos/recurso";
import type { RecursoLeccion } from "@/lib/leccion";

export type TabPlayer = "recursos" | "resumen" | "comentarios";

/**
 * Comentario de una clase. El esquema todavía no tiene tabla de comentarios
 * (ver prisma/schema.prisma), así que hoy la pestaña se renderiza vacía; el
 * tipo existe para que la lista se conecte sin tocar el marcado cuando el
 * módulo de comentarios entre.
 */
export type ComentarioLeccion = {
  id: string;
  autor: string;
  iniciales: string;
  esInstructor: boolean;
  tiempo: string;
  texto: string;
  likes: number;
  respuestas: number;
  adjunto: { tipo: string; nombre: string } | null;
};

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
                {recurso.tipoArchivo.toUpperCase()}
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

export function ComentariosTab({ comentarios }: { comentarios: ComentarioLeccion[] }) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center gap-2.5">
        <span className="text-[12.5px] text-uva-muted">
          {comentarios.length === 0
            ? "Sé el primero en comentar esta clase"
            : `${comentarios.length} ${comentarios.length === 1 ? "comentario" : "comentarios"} en esta clase`}
        </span>
        <span className="ml-auto text-[12px] text-uva-muted">Más votados ▾</span>
      </div>

      <textarea
        placeholder="Escribe tu duda o aporta a la clase…"
        className="min-h-[74px] w-full resize-y rounded-uva-md border border-uva-divider bg-uva-surface px-2.5 py-1.5 text-sm text-uva-text caret-uva-accent outline-none placeholder:text-uva-text-faint hover:border-uva-text/45 focus-visible:border-uva-accent"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-uva-md border border-uva-divider bg-transparent px-[15.84px] py-[8.8px] text-[12px] font-semibold text-uva-text hover:bg-[#27272A]"
        >
          Adjuntar foto de obra
        </button>
      </div>

      <div className="h-px bg-uva-divider" />

      <div className="flex flex-col gap-[18px]">
        {comentarios.map((comentario) => (
          <div key={comentario.id} className="flex gap-[11px]">
            <div className="size-8 shrink-0 overflow-hidden rounded-full">
              <div className="grid size-full place-items-center bg-[#27272A] text-[12px] font-semibold tracking-[0.02em] text-uva-muted">
                {comentario.iniciales}
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-[7px]">
                <span className="text-[13px] font-bold text-uva-text">{comentario.autor}</span>
                {comentario.esInstructor ? (
                  <span className="inline-flex items-center rounded-uva-xs bg-uva-accent-2-soft px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] text-uva-accent-2-text">
                    Instructor
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-uva-xs bg-[#27272A] px-2.5 py-[3px] text-[11px] font-semibold tracking-[0.02em] text-uva-muted">
                    Alumno
                  </span>
                )}
                <span className="text-[11px] text-uva-text opacity-45">{comentario.tiempo}</span>
              </div>
              <p className="mt-[5px] mb-[7px] text-[13px] text-uva-text opacity-80">
                {comentario.texto}
              </p>
              {comentario.adjunto ? (
                <div className="mb-[7px] flex items-center gap-2 rounded-uva-md bg-uva-text/[0.07] px-[11px] py-[7px] text-[11.5px] text-uva-text">
                  <span className="inline-flex items-center rounded-uva-xs bg-[#27272A] px-2.5 py-[3px] font-mono text-[11px] font-semibold tracking-[0.02em] text-uva-muted">
                    {comentario.adjunto.tipo}
                  </span>
                  {comentario.adjunto.nombre}
                </div>
              ) : null}
              <div className="flex gap-3.5 text-[12px] text-uva-text opacity-60">
                <span>♥ {comentario.likes}</span>
                <span>Responder</span>
                {comentario.respuestas > 0 ? <span>Ver {comentario.respuestas} respuestas</span> : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
