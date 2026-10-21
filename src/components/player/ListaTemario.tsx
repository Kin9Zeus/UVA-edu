"use client";

import Link from "next/link";
import { Check, FileCheck, Lock } from "lucide-react";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { formatDuracion } from "@/lib/admin/format";
import type { LeccionPlayer, LeccionPlayerItem } from "@/lib/leccion";
import { cn } from "@/lib/utils";

export const FOCO =
  "outline-hidden focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

/** Qué dice la fila del examen según su estado (`getSituacionExamen`). */
const ESTADO_EXAMEN: Record<NonNullable<LeccionPlayer["situacionExamen"]>, string> = {
  DISPONIBLE: "Disponible",
  EN_CURSO: "Tienes un intento en curso",
  EN_ESPERA: "En espera para otro intento",
  APROBADO: "Aprobado",
};

export type ExamenTemario = { href: string; situacion: NonNullable<LeccionPlayer["situacionExamen"]> };

/**
 * Clases del curso agrupadas por módulo, con su miniatura, y al final el
 * examen. La comparten el panel desplegable (TemarioDrawer, celular y tablet)
 * y la pestaña "Temario" de la columna lateral (escritorio).
 *
 * Cada clase es un enlace (`hrefDe`); `onElegir` cierra el panel al tocar una.
 * Sin sesión (`sinSesion`) las demás clases llevan candado: su enlace pasa por
 * iniciar sesión (lo decide `hrefDe`).
 */
export function ListaTemario({
  lecciones,
  leccionActualId,
  hrefDe,
  onElegir,
  examen = null,
  sinSesion = false,
  total,
}: {
  lecciones: LeccionPlayerItem[];
  leccionActualId: string;
  hrefDe: (leccion: LeccionPlayerItem) => string;
  onElegir?: () => void;
  examen?: ExamenTemario | null;
  sinSesion?: boolean;
  /** Para marcar la primera clase como "Introducción" solo si hay más de una. */
  total: number;
}) {
  const modulos: { id: string; titulo: string; lecciones: LeccionPlayerItem[] }[] = [];
  for (const leccion of lecciones) {
    const ultimo = modulos.at(-1);
    if (ultimo && ultimo.id === leccion.moduloId) ultimo.lecciones.push(leccion);
    else modulos.push({ id: leccion.moduloId, titulo: leccion.moduloTitulo, lecciones: [leccion] });
  }

  return (
    <div className="flex flex-col">
      {modulos.map((modulo) => (
        <div key={modulo.id}>
          <h3 className="m-0 mb-[9px] text-[10px] font-semibold tracking-[0.12em] text-uva-text-muted uppercase">
            {modulo.titulo}
          </h3>
          <ul className="m-0 mb-[22px] flex list-none flex-col gap-[9px] p-0">
            {modulo.lecciones.map((leccion) => {
              const esActual = leccion.id === leccionActualId;
              const completadaSinAbrir = leccion.completado && !esActual;
              const conCandado = sinSesion && !esActual;
              return (
                <li key={leccion.id}>
                  <Link
                    href={hrefDe(leccion)}
                    onClick={onElegir}
                    aria-current={esActual ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-[11px] rounded-uva-md border p-[9px] text-left text-uva-text hover:no-underline",
                      FOCO,
                      esActual
                        ? "border-transparent bg-uva-accent/14"
                        : completadaSinAbrir
                          ? "border-uva-accent-2/35 bg-uva-accent-2-soft"
                          : "border-transparent bg-uva-text/5 hover:bg-uva-text/10",
                    )}
                  >
                    <div className="relative h-[38px] w-[62px] shrink-0 overflow-hidden rounded-uva-md bg-uva-surface-2">
                      {leccion.miniaturaUrl && (
                        <MiniaturaMux src={leccion.miniaturaUrl} loading="lazy" className="absolute inset-0 size-full object-cover" />
                      )}
                      {completadaSinAbrir ? (
                        <div className="absolute inset-0 grid place-items-center bg-uva-bg/45">
                          <Check className="size-4 text-uva-accent-2" strokeWidth={3} aria-hidden />
                        </div>
                      ) : null}
                      {conCandado ? (
                        <div className="absolute inset-0 grid place-items-center bg-uva-bg/55">
                          <Lock className="size-4 text-uva-text" strokeWidth={2.4} aria-hidden />
                        </div>
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-semibold text-uva-text">
                        {leccion.numero} · {leccion.titulo}
                      </div>
                      <div
                        className={cn(
                          "text-[11px]",
                          completadaSinAbrir ? "font-semibold text-uva-accent-2-text" : "text-uva-text-muted",
                        )}
                      >
                        {/* Sin duración todavía (el video no terminó de
                            procesarse): se dice, no un "—". */}
                        {leccion.duracion ? formatDuracion(leccion.duracion) : "Video en preparación"}
                        {leccion.numero === 1 && total > 1 ? " · Introducción" : ""}
                        {esActual
                          ? sinSesion
                            ? " · clase gratis"
                            : " · en curso"
                          : conCandado
                            ? " · entra para verla"
                            : leccion.completado
                              ? " · clase completada"
                              : ""}
                      </div>
                    </div>
                    {completadaSinAbrir ? (
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-uva-accent-2 text-uva-on-bright">
                        <Check className="size-3.5" strokeWidth={3} aria-hidden />
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {examen && (
        <Link
          href={examen.href}
          onClick={onElegir}
          className={cn(
            "flex items-center gap-[11px] rounded-uva-md border p-[9px] text-uva-text hover:no-underline",
            FOCO,
            examen.situacion === "APROBADO"
              ? "border-uva-accent-2/35 bg-uva-accent-2-soft"
              : "border-uva-line-strong bg-transparent hover:border-uva-text",
          )}
        >
          <span className="grid h-[38px] w-[62px] shrink-0 place-items-center rounded-uva-md bg-uva-accent/14 text-uva-accent-ink">
            <FileCheck className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-semibold">Examen final</span>
            <span
              className={cn(
                "block text-[11px]",
                examen.situacion === "APROBADO" ? "font-semibold text-uva-accent-2-text" : "text-uva-text-muted",
              )}
            >
              {ESTADO_EXAMEN[examen.situacion]}
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
