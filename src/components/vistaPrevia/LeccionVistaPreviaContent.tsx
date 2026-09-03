"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Eye, FileText } from "lucide-react";
import { extensionArchivo, formatDuracion } from "@/lib/admin/format";
import type { LeccionVistaPrevia } from "@/lib/admin/resolverVistaPrevia";
import { TabsHeader, ResumenTab, type TabPlayer } from "@/components/player/PlayerTabs";
import { TemarioDrawer } from "@/components/player/TemarioDrawer";

/**
 * Vista previa de cómo se ve el reproductor de una clase, para un enlace sin
 * sesión (Revcurso). A propósito NO es el reproductor real:
 *
 *  - Sin video: nunca se le pasa `id_video_mux` a nada que pueda pedirlo a
 *    Mux, así que no hay forma de que este componente filtre una URL de
 *    reproducción real.
 *  - Recursos sin enlace de descarga: se listan nombre/tipo/tamaño (para
 *    que el administrador vea que la clase sí tiene material) pero sin
 *    `url_archivo` — ese campo ni siquiera llega desde
 *    getLeccionVistaPrevia().
 *  - Sin progreso: quien abre el enlace no tiene usuario, así que no hay
 *    "marcar como completada" ni porcentaje; la lista de clases se muestra
 *    siempre sin marcar.
 */
export function LeccionVistaPreviaContent({
  data,
  token,
}: {
  data: LeccionVistaPrevia;
  token: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabPlayer>("recursos");
  const [temarioOpen, setTemarioOpen] = useState(false);

  const hrefLeccion = (leccionId: string) => `/vista-previa/${token}/${leccionId}`;

  return (
    <div className="mx-auto max-w-[1320px] px-[clamp(20px,3vw,44px)] py-6">
      <div className="mb-[18px] flex items-center gap-3.5 rounded-uva-md bg-uva-text/[0.06] px-[18px] py-3">
        <Link
          href={`/vista-previa/${token}`}
          className="inline-flex items-center gap-[7px] rounded-uva-md border-0 bg-transparent px-2 py-1.5 text-sm font-semibold text-uva-text no-underline"
        >
          <ChevronLeft className="size-[15px]" strokeWidth={2.75} />
          {data.cursoTitulo}
        </Link>
        <span className="text-[12.5px] text-uva-text opacity-50">
          Clase {data.numero} de {data.totalClases}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTemarioOpen(true)}
            className="inline-flex items-center rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-2 text-[12.5px] font-semibold text-uva-text hover:bg-[#27272A]"
          >
            Temario
          </button>
          {data.siguienteId ? (
            <Link
              href={hrefLeccion(data.siguienteId)}
              className="inline-flex items-center rounded-uva-md border border-transparent bg-uva-accent px-4 py-2 text-[12.5px] font-semibold text-white no-underline hover:bg-uva-accent-hover"
            >
              Siguiente clase →
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[clamp(14px,2vw,24px)] lg:grid-cols-[minmax(0,1fr)_clamp(272px,25vw,352px)]">
        <div>
          <div className="relative flex h-[452px] flex-col items-center justify-center gap-3 overflow-hidden rounded-uva-md bg-black text-center">
            <div className="grid size-[60px] place-items-center rounded-full bg-uva-text/10">
              <Eye className="size-6 text-uva-muted" strokeWidth={1.8} />
            </div>
            <p className="m-0 max-w-[320px] text-[13px] text-uva-muted">
              Vista previa del diseño de la clase. El video no se reproduce desde un enlace sin
              sesión.
            </p>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
            <TabsHeader tab={tab} onTab={setTab} totalRecursos={data.recursos.length} />
            {tab === "recursos" && (
              <div className="flex flex-col gap-3">
                {data.recursos.length === 0 ? (
                  <div className="rounded-uva-md bg-[#27272A] px-[13px] py-[11px] text-[13px] text-uva-muted">
                    Esta clase todavía no tiene recursos descargables.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {data.recursos.map((recurso) => (
                      <div
                        key={recurso.id}
                        className="flex items-center gap-[11px] rounded-uva-md bg-[#27272A] px-[13px] py-[11px]"
                      >
                        <span className="inline-flex items-center rounded-uva-xs bg-uva-surface px-2.5 py-[3px] font-mono text-[11px] font-semibold tracking-[0.02em] text-uva-muted">
                          {extensionArchivo(recurso.nombre)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[13px] font-semibold text-uva-text">
                            {recurso.nombre}
                          </div>
                        </div>
                        <FileText className="size-4 shrink-0 text-uva-muted" strokeWidth={2.2} />
                      </div>
                    ))}
                  </div>
                )}
                <p className="m-0 text-[11.5px] text-uva-muted">
                  La descarga no está disponible en la vista previa.
                </p>
              </div>
            )}
            {tab === "resumen" && <ResumenTab resumen={data.resumen} />}
          </div>
        </div>

        <div className="top-[88px] flex max-h-[calc(100vh-112px)] flex-col gap-3.5 overflow-auto rounded-uva-md border border-uva-divider bg-uva-surface p-5 lg:sticky">
          <h4 className="m-0 font-heading text-[17px] font-bold tracking-[-0.03em] text-uva-text">
            Clases
          </h4>
          <p className="m-0 -mt-2 text-[11.5px] text-uva-muted">
            El progreso solo se guarda para estudiantes con sesión.
          </p>

          <div className="flex max-h-[480px] flex-col gap-[5px] overflow-auto">
            {data.lecciones.map((leccion) => {
              const esActual = leccion.id === data.leccionId;
              return (
                <Link
                  key={leccion.id}
                  href={hrefLeccion(leccion.id)}
                  className={`flex items-center gap-[11px] rounded-uva-md border-0 px-[11px] py-[9px] text-left no-underline ${
                    esActual ? "bg-uva-accent/14" : "bg-transparent hover:bg-uva-text/5"
                  }`}
                >
                  <div className="grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-[#3F3F46] text-[11px] font-bold" />
                  <div className="min-w-0 flex-1 text-[12.5px] leading-[1.3] text-uva-text">
                    {leccion.numero} · {leccion.titulo}
                  </div>
                  <div className="font-mono text-[11px] text-uva-muted">
                    {formatDuracion(leccion.duracion)}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <TemarioDrawer
        abierto={temarioOpen}
        onCerrar={() => setTemarioOpen(false)}
        lecciones={data.lecciones.map((leccion) => ({ ...leccion, completado: false }))}
        leccionActualId={data.leccionId}
        completadas={0}
        total={data.totalClases}
        porcentaje={0}
        onIrALeccion={(leccionId) => {
          setTemarioOpen(false);
          router.push(hrefLeccion(leccionId));
        }}
      />
    </div>
  );
}
