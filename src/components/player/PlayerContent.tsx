"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { formatDuracion } from "@/lib/admin/format";
import { iniciarProgresoLeccion, marcarLeccion } from "@/actions/progreso/marcar";
import type { LeccionPlayer } from "@/lib/leccion";
import { VideoFrame } from "./VideoFrame";
import { TabsHeader, RecursosTab, ResumenTab, ComentariosTab, type TabPlayer } from "./PlayerTabs";
import { TemarioDrawer } from "./TemarioDrawer";

export function PlayerContent({ data }: { data: LeccionPlayer }) {
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
  const [pendiente, startTransition] = useTransition();

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
      <div className="mb-[18px] flex items-center gap-3.5 rounded-uva-md bg-uva-text/[0.06] px-[18px] py-3">
        <Link
          href={`/cursos/${data.cursoId}`}
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
            className="inline-flex items-center rounded-uva-md border-0 bg-transparent px-2 py-1.5 text-[12.5px] font-semibold text-uva-text opacity-60"
          >
            Reportar
          </button>
          <button
            type="button"
            onClick={() => setTemarioOpen(true)}
            className="inline-flex items-center rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-2 text-[12.5px] font-semibold text-uva-text hover:bg-[#27272A]"
          >
            Temario
          </button>
          {data.siguienteId ? (
            <button
              type="button"
              onClick={() => irALeccion(data.siguienteId!)}
              className="inline-flex items-center rounded-uva-md border border-transparent bg-uva-accent px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-uva-accent-hover"
            >
              Siguiente clase →
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-[clamp(14px,2vw,24px)] lg:grid-cols-[minmax(0,1fr)_clamp(272px,25vw,352px)]">
        <div>
          <VideoFrame
            leccionId={data.leccionId}
            videoListo={data.videoListo}
            titulo={data.leccionTitulo}
            segundoActual={data.segundoActual}
            onTerminado={completarPorFinDeVideo}
          />

          <div className="mt-5 flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
            <TabsHeader
              tab={tab}
              onTab={setTab}
              totalRecursos={data.recursos.length}
              totalComentarios={0}
            />
            {tab === "recursos" && <RecursosTab recursos={data.recursos} />}
            {tab === "resumen" && <ResumenTab resumen={data.resumen} />}
            {tab === "comentarios" && <ComentariosTab comentarios={[]} />}
          </div>
        </div>

        <div className="top-[88px] flex max-h-[calc(100vh-112px)] flex-col gap-3.5 overflow-auto rounded-uva-md border border-uva-divider bg-uva-surface p-5 lg:sticky">
          <div className="flex items-center gap-2">
            <h4 className="m-0 font-heading text-[17px] font-bold tracking-[-0.03em] text-uva-text">
              Clases y progreso
            </h4>
          </div>

          <div>
            <div className="mb-[7px] flex items-baseline gap-2">
              <span className="font-mono text-xl font-bold text-uva-text">{porcentaje}%</span>
              <span className="text-xs text-uva-muted">
                completado · {completadas} de {data.totalClases} clases
              </span>
            </div>
            <div className="h-[7px] overflow-hidden rounded-full bg-[#27272A]">
              <div
                className="h-full rounded-full bg-uva-accent transition-[width] duration-200 ease-out"
                style={{ width: `${porcentaje}%` }}
              />
            </div>
          </div>

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

          <button
            type="button"
            disabled={pendiente}
            onClick={toggleCompletada}
            className="mt-0 inline-flex w-full items-center justify-center rounded-uva-md border border-transparent bg-uva-accent px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-uva-accent-hover disabled:opacity-60"
          >
            {completada ? `Clase ${data.numero} completada ✓` : `Marcar clase ${data.numero} como completada`}
          </button>
          <p className="m-0 text-[11.5px] text-uva-muted">
            La clase se marca sola al terminar el video; también puedes marcarla a mano.
          </p>
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
