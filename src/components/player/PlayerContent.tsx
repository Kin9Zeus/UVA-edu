"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, List } from "lucide-react";
import { formatDuracion } from "@/lib/admin/format";
import { iniciarProgresoLeccion, marcarLeccion } from "@/actions/progreso/marcar";
import type { LeccionPlayer } from "@/lib/leccion";
import type { ComentarioConRespuestas } from "@/lib/comentarios";
import { VideoFrame } from "./VideoFrame";
import {
  TabsHeader,
  RecursosTab,
  ResumenTab,
  ComentariosTab,
  contarComentarios,
  type TabPlayer,
} from "./PlayerTabs";
import { TemarioDrawer } from "./TemarioDrawer";

function ProgresoBarra({
  porcentaje,
  completadas,
  totalClases,
}: {
  porcentaje: number;
  completadas: number;
  totalClases: number;
}) {
  return (
    <div>
      <div className="mb-[7px] flex items-baseline gap-2">
        <span className="font-mono text-xl font-bold text-uva-text">{porcentaje}%</span>
        <span className="text-xs text-uva-muted">
          completado · {completadas} de {totalClases} clases
        </span>
      </div>
      <div className="h-[7px] overflow-hidden rounded-full bg-[#27272A]">
        <div
          className="h-full rounded-full bg-uva-accent transition-[width] duration-200 ease-out"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </div>
  );
}

export function PlayerContent({
  data,
  comentariosIniciales,
  usuarioActualId,
  esAdmin,
}: {
  data: LeccionPlayer;
  comentariosIniciales: ComentarioConRespuestas[];
  usuarioActualId: string | null;
  esAdmin: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabPlayer>("recursos");
  const [temarioOpen, setTemarioOpen] = useState(false);
  const [completada, setCompletada] = useState(data.completada);
  // Copia local de qué clases están completadas: permite que la lista lateral
  // y la barra de progreso reflejen el cambio al instante, sin esperar a que
  // Next.js revalide la ruta tras el Server Action.
  const [completadoPorLeccion, setCompletadoPorLeccion] = useState(() =>
    new Map(data.lecciones.map((leccion) => [leccion.id, leccion.completado])),
  );
  const [, startTransition] = useTransition();

  // Se dispara al abrir la clase, no al terminarla: es lo que le da sentido
  // a "Seguir viendo" en la ficha del curso y a "Sigue aprendiendo" del
  // dashboard, que antes solo veían clases ya marcadas como completadas.
  useEffect(() => {
    void iniciarProgresoLeccion(data.leccionId);
  }, [data.leccionId]);

  const irALeccion = (leccionId: string) => router.push(`/cursos/${data.cursoId}/${leccionId}`);

  const completadas = [...completadoPorLeccion.values()].filter(Boolean).length;
  const porcentaje =
    data.totalClases > 0 ? Math.round((completadas / data.totalClases) * 100) : 0;

  function toggleCompletada() {
    const siguiente = !completada;
    setCompletada(siguiente);
    setCompletadoPorLeccion((mapa) => new Map(mapa).set(data.leccionId, siguiente));
    startTransition(async () => {
      const resultado = await marcarLeccion(data.leccionId, siguiente);
      if ("error" in resultado) {
        setCompletada(!siguiente);
        setCompletadoPorLeccion((mapa) => new Map(mapa).set(data.leccionId, !siguiente));
      } else {
        router.refresh();
      }
    });
  }

  // El reproductor llama esto una sola vez al terminar el video (evento
  // `ended`). Reusa el mismo camino optimista que el botón manual, pero solo
  // si la clase todavía no estaba completada — evitar repetir la escritura
  // no cambia el resultado, pero sí evita un upsert de sobra si el
  // estudiante vuelve a ver una clase ya completada hasta el final.
  function completarPorFinDeVideo() {
    if (completada) return;
    toggleCompletada();
  }

  return (
    <div className="mx-auto max-w-[1320px] px-[clamp(20px,3vw,44px)] py-6">
      {/* Mobile: esta página no usa el header del sitio (ver page.tsx) —
          esta barra sticky hace de header, minimalista al estilo del
          reproductor de Platzi: volver, contador de clase (abre el Temario)
          y siguiente clase, nada más. */}
      <div className="sticky top-0 z-40 -mx-[clamp(20px,3vw,44px)] mb-[18px] flex items-center gap-2 border-b border-uva-divider bg-uva-bg/95 px-[18px] py-3 backdrop-blur lg:hidden">
        <Link
          href={`/cursos/${data.cursoId}`}
          aria-label="Volver al curso"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-uva-text hover:bg-uva-text/10"
        >
          <ChevronDown className="size-5" strokeWidth={2.2} />
        </Link>
        <button
          type="button"
          onClick={() => setTemarioOpen(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-uva-text/10 px-3.5 py-1.5 text-[12.5px] font-semibold text-uva-text"
        >
          Clase {data.numero}/{data.totalClases}
          <ChevronDown className="size-3.5" strokeWidth={2.5} />
        </button>
        {data.siguienteId ? (
          <button
            type="button"
            onClick={() => irALeccion(data.siguienteId!)}
            aria-label="Siguiente clase"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-uva-accent text-white hover:bg-uva-accent-hover"
          >
            <ChevronRight className="size-5" strokeWidth={2.5} />
          </button>
        ) : null}
      </div>

      {/* Desktop: barra completa con título, contador, Reportar, Temario y
          Siguiente clase. */}
      <div className="mb-[18px] hidden items-center gap-3.5 rounded-uva-md bg-uva-text/[0.06] px-[18px] py-3 lg:flex">
        <Link
          href={`/cursos/${data.cursoId}`}
          className="inline-flex min-w-0 items-center gap-[7px] rounded-uva-md border-0 bg-transparent px-2 py-1.5 text-sm font-semibold text-uva-text no-underline"
        >
          <ChevronLeft className="size-[15px] shrink-0" strokeWidth={2.75} />
          <span className="truncate">{data.cursoTitulo}</span>
        </Link>
        <span className="shrink-0 text-[12.5px] text-uva-text opacity-50">
          Clase {data.numero} de {data.totalClases}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center rounded-uva-md border-0 bg-transparent px-2 py-1.5 text-[12.5px] font-semibold text-uva-text opacity-60"
          >
            Reportar
          </button>
          <button
            type="button"
            onClick={() => setTemarioOpen(true)}
            aria-label="Temario"
            className="inline-flex items-center gap-1.5 rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-2 text-[12.5px] font-semibold text-uva-text hover:bg-[#27272A]"
          >
            <List className="size-4" strokeWidth={2} />
            Temario
          </button>
          {data.siguienteId ? (
            <button
              type="button"
              onClick={() => irALeccion(data.siguienteId!)}
              aria-label="Siguiente clase"
              className="inline-flex items-center gap-1.5 rounded-uva-md border border-transparent bg-uva-accent px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-uva-accent-hover"
            >
              Siguiente clase
              <ChevronRight className="size-4" strokeWidth={2.5} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[clamp(14px,2vw,24px)] lg:grid-cols-[minmax(0,1fr)_clamp(272px,25vw,352px)]">
        <div>
          {/* Mobile: el video llega a los bordes de la pantalla (margen
              negativo cancelando el padding del contenedor de la página);
              desde lg vuelve a su ancho normal dentro de la columna. */}
          <div className="-mx-[clamp(20px,3vw,44px)] lg:mx-0">
            <VideoFrame
              leccionId={data.leccionId}
              videoListo={data.videoListo}
              titulo={data.leccionTitulo}
              segundoActual={data.segundoActual}
              onTerminado={completarPorFinDeVideo}
              className="rounded-none lg:rounded-uva-md"
            />
          </div>

          {/* Mobile: el nombre de la clase no aparece en ningún otro lado
              (la barra de arriba solo trae el contador); en desktop ya se ve
              en la barra completa de arriba. */}
          <h1 className="mt-4 text-[19px] leading-snug font-bold text-uva-text lg:hidden">
            {data.leccionTitulo}
          </h1>

          <div className="mt-5 flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
            <TabsHeader
              tab={tab}
              onTab={setTab}
              totalRecursos={data.recursos.length}
              totalComentarios={contarComentarios(comentariosIniciales)}
            />
            {tab === "recursos" && <RecursosTab recursos={data.recursos} />}
            {tab === "resumen" && <ResumenTab resumen={data.resumen} />}
            {tab === "comentarios" && (
              <ComentariosTab
                cursoId={data.cursoId}
                leccionId={data.leccionId}
                comentarios={comentariosIniciales}
                puedeComentar={data.puedeComentar}
                usuarioActualId={usuarioActualId}
                esAdmin={esAdmin}
                onCambio={() => router.refresh()}
              />
            )}
          </div>
        </div>

        <div className="top-[88px] hidden max-h-[calc(100vh-112px)] flex-col gap-3.5 overflow-auto rounded-uva-md border border-uva-divider bg-uva-surface p-5 lg:sticky lg:flex">
          <div className="flex items-center gap-2">
            <h4 className="m-0 font-heading text-[17px] font-bold tracking-[-0.03em] text-uva-text">
              Clases y progreso
            </h4>
          </div>

          <ProgresoBarra porcentaje={porcentaje} completadas={completadas} totalClases={data.totalClases} />

          <div className="flex max-h-[420px] flex-col gap-[5px] overflow-auto">
            {data.lecciones.map((leccion) => {
              const estaCompletada = completadoPorLeccion.get(leccion.id) ?? false;
              const esActual = leccion.id === data.leccionId;
              const ring = estaCompletada
                ? "border-uva-accent-2"
                : esActual
                  ? "border-uva-accent"
                  : "border-[#3F3F46]";
              const fill = estaCompletada ? "bg-uva-accent-2" : "bg-transparent";
              return (
                <button
                  key={leccion.id}
                  type="button"
                  onClick={() => irALeccion(leccion.id)}
                  className={`flex cursor-pointer items-center gap-[11px] rounded-uva-md border-0 px-[11px] py-[9px] text-left ${
                    esActual ? "bg-uva-accent/14" : "bg-transparent hover:bg-uva-text/5"
                  }`}
                >
                  <div
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] text-[11px] font-bold text-uva-bg ${ring} ${fill}`}
                  >
                    {estaCompletada ? "✓" : ""}
                  </div>
                  <div className="min-w-0 flex-1 text-[12.5px] leading-[1.3] text-uva-text">
                    {leccion.numero} · {leccion.titulo}
                  </div>
                  <div className="font-mono text-[11px] text-uva-muted">
                    {formatDuracion(leccion.duracion)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <TemarioDrawer
        abierto={temarioOpen}
        onCerrar={() => setTemarioOpen(false)}
        lecciones={data.lecciones.map((leccion) => ({
          ...leccion,
          completado: completadoPorLeccion.get(leccion.id) ?? false,
        }))}
        leccionActualId={data.leccionId}
        completadas={completadas}
        total={data.totalClases}
        porcentaje={porcentaje}
        onIrALeccion={(leccionId) => {
          setTemarioOpen(false);
          irALeccion(leccionId);
        }}
      />
    </div>
  );
}
