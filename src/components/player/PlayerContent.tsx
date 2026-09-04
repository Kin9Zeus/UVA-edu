"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, List } from "lucide-react";
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

// Tarjeta de refuerzo psicológico: solo el % y cuántas clases faltan, sin la
// lista de clases (esa vive en TemarioDrawer, no hay que duplicarla).
function ProgresoCard({
  porcentaje,
  completadas,
  totalClases,
}: {
  porcentaje: number;
  completadas: number;
  totalClases: number;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
      <h4 className="m-0 font-heading text-[17px] font-bold tracking-[-0.03em] text-uva-text">
        Progreso
      </h4>
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

  // `data.anteriorId`/`data.siguienteId` y el Temario (TemarioDrawer, también
  // usado por LeccionVistaPreviaContent con lecciones que no tienen slug)
  // siguen navegando por id — esta tabla los traduce al slug real de la
  // lección justo antes de construir la URL.
  const slugPorLeccionId = new Map(data.lecciones.map((leccion) => [leccion.id, leccion.slug]));
  const irALeccion = (leccionId: string) =>
    router.push(`/cursos/${data.cursoSlug}/${slugPorLeccionId.get(leccionId) ?? leccionId}`);

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
          href={`/cursos/${data.cursoSlug}`}
          aria-label="Volver al curso"
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-uva-text hover:bg-uva-text/10"
        >
          <ChevronDown className="size-5" strokeWidth={2.2} />
        </Link>
        {data.anteriorId ? (
          <button
            type="button"
            onClick={() => irALeccion(data.anteriorId!)}
            aria-label="Clase anterior"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-uva-text hover:bg-uva-text/10"
          >
            <ChevronLeft className="size-5" strokeWidth={2.2} />
          </button>
        ) : null}
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

      {/* Desktop: barra completa con título, contador, clase anterior,
          Temario y Siguiente clase. */}
      <div className="mb-[18px] hidden items-center gap-3.5 rounded-uva-md bg-uva-text/[0.06] px-[18px] py-3 lg:flex">
        <Link
          href={`/cursos/${data.cursoSlug}`}
          className="inline-flex min-w-0 items-center gap-[7px] rounded-uva-md border-0 bg-transparent px-2 py-1.5 text-sm font-semibold text-uva-text no-underline"
        >
          <ChevronLeft className="size-[15px] shrink-0" strokeWidth={2.75} />
          <span className="truncate">{data.cursoTitulo}</span>
        </Link>
        <span className="shrink-0 text-[12.5px] text-uva-text opacity-50">
          Clase {data.numero} de {data.totalClases}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {data.anteriorId ? (
            <button
              type="button"
              onClick={() => irALeccion(data.anteriorId!)}
              aria-label="Clase anterior"
              className="inline-flex items-center gap-1.5 rounded-uva-md border border-uva-divider bg-uva-surface px-3 py-2 text-[12.5px] font-semibold text-uva-text hover:bg-[#27272A]"
            >
              <ChevronLeft className="size-4" strokeWidth={2.5} />
            </button>
          ) : null}
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

      <div className="grid grid-cols-1 items-start gap-[clamp(14px,2vw,24px)] lg:grid-cols-[minmax(0,1fr)_clamp(360px,32vw,480px)]">
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

          {/* Mobile: la tarjeta de progreso vive acá, en la columna única;
              en desktop se muestra en el sidebar (ver más abajo). */}
          <div className="mt-4 lg:hidden">
            <ProgresoCard porcentaje={porcentaje} completadas={completadas} totalClases={data.totalClases} />
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
            <TabsHeader
              tab={tab}
              onTab={setTab}
              totalRecursos={data.recursos.length}
              totalComentarios={contarComentarios(comentariosIniciales)}
            />
            {tab === "recursos" && <RecursosTab recursos={data.recursos} />}
            {tab === "resumen" && <ResumenTab contenido={data.contenido} />}
            {tab === "comentarios" && (
              <div className="lg:hidden">
                <ComentariosTab
                  ruta={`/cursos/${data.cursoSlug}/${data.leccionSlug}`}
                  leccionId={data.leccionId}
                  comentarios={comentariosIniciales}
                  puedeComentar={data.puedeComentar}
                  usuarioActualId={usuarioActualId}
                  esAdmin={esAdmin}
                  onCambio={() => router.refresh()}
                />
              </div>
            )}
          </div>
        </div>

        {/* Desktop: columna derecha con Progreso arriba y Comentarios abajo.
            Un solo hijo grid acá (este wrapper) para no romper las 2
            columnas del grid de arriba — si Progreso y Comentarios fueran
            hijos grid directos, el tercer elemento caería en una fila nueva
            bajo la columna del video en vez de quedarse a la derecha.
            La tarjeta de Comentarios sigue deliberadamente NO `sticky`: los
            dos intentos anteriores con `position: sticky` producían un
            deslizamiento visible al hacer scroll (primero se despegaba antes
            de tiempo por tener alto variable, y ajustar el alto a `100vh`
            para evitarlo dejaba un "alcance" notorio hasta engancharse) —
            vive en flujo normal, igual que la columna del video, sin ese
            salto. */}
        <div className="hidden flex-col gap-[clamp(14px,2vw,24px)] lg:flex">
          <ProgresoCard porcentaje={porcentaje} completadas={completadas} totalClases={data.totalClases} />

          <div className="flex flex-col gap-3.5 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
            <ComentariosTab
              ruta={`/cursos/${data.cursoSlug}/${data.leccionSlug}`}
              leccionId={data.leccionId}
              comentarios={comentariosIniciales}
              puedeComentar={data.puedeComentar}
              usuarioActualId={usuarioActualId}
              esAdmin={esAdmin}
              onCambio={() => router.refresh()}
            />
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
