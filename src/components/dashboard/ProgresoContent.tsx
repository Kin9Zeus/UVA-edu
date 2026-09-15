"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AnilloProgreso } from "@/components/dashboard/AnilloProgreso";
import { esPortadaReal } from "@/lib/media";
import { formatDuracion } from "@/lib/admin/format";
import type { ProgresoData } from "@/lib/progreso";

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

type Filtro = "todos" | "en_progreso" | "completados";
type Orden = "recientes" | "porcentaje";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "en_progreso", etiqueta: "En progreso" },
  { valor: "completados", etiqueta: "Completados" },
];

/**
 * Qué porcentaje del video lleva visto. Acotado a 100 porque el reproductor
 * puede guardar un segundo mayor que la duración declarada por un redondeo.
 */
function porcentajeVisto(reanudar: { segundo: number; duracion: number | null }): number {
  if (!reanudar.duracion || reanudar.duracion <= 0) return 0;
  return Math.min(100, Math.round((reanudar.segundo / reanudar.duracion) * 100));
}

export function ProgresoContent({ data }: { data: ProgresoData }) {
  const { cursos } = data;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<Orden>("recientes");

  const cursosVisibles = useMemo(() => {
    const filtrados = cursos.filter((curso) => {
      // `completado` y no `porcentaje === 100`: un curso con todas las clases
      // vistas pero el examen final sin aprobar sigue en progreso (no tiene
      // certificado). Ver lib/progreso.ts.
      if (filtro === "en_progreso") return !curso.completado;
      if (filtro === "completados") return curso.completado;
      return true;
    });
    // `cursos` ya llega ordenado por actividad reciente (order de la vista
    // progreso_cursos_estudiante) — "recientes" no reordena nada; solo se
    // copia el arreglo para "porcentaje" antes de mutarlo con sort().
    return orden === "porcentaje"
      ? [...filtrados].sort((a, b) => b.porcentaje - a.porcentaje)
      : filtrados;
  }, [cursos, filtro, orden]);

  return (
    <div className="flex max-w-[1080px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <h1 className="text-2xl text-uva-text">Tu progreso</h1>

      <div>
        {cursos.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-full border border-uva-divider p-1">
              {FILTROS.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => setFiltro(opcion.valor)}
                  className={`rounded-full px-3 py-1 text-[12.5px] transition-colors ${
                    filtro === opcion.valor
                      ? "bg-uva-accent text-white"
                      : "text-uva-text-muted hover:text-uva-text"
                  }`}
                >
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
            <Select value={orden} onValueChange={(valor) => setOrden(valor as Orden)}>
              <SelectTrigger className="h-8 bg-uva-bg text-[12.5px]" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recientes">Más recientes</SelectItem>
                <SelectItem value="porcentaje">Más avanzados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {cursos.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-uva-md border border-uva-divider bg-uva-surface px-6 py-12 text-center">
            <p className="text-sm text-uva-text-muted">
              Todavía no has empezado ningún curso. Explora el catálogo para arrancar.
            </p>
            <Link
              href="/dashboard/catalogo"
              className="inline-flex h-10 items-center justify-center rounded-uva-md bg-uva-accent px-5 text-sm font-semibold text-white no-underline hover:bg-uva-accent-hover hover:no-underline"
            >
              Ver catálogo
            </Link>
          </div>
        ) : cursosVisibles.length === 0 ? (
          <p className="py-6 text-center text-sm text-uva-text-muted">
            No tienes cursos {filtro === "completados" ? "completados" : "en progreso"} todavía.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {cursosVisibles.map((curso) => (
              <Link
                key={curso.cursoId}
                href={`/cursos/${curso.cursoSlug}`}
                className="group flex flex-col gap-2.5"
              >
                {/* El frame donde quedó manda sobre la portada: una rejilla
                    de portadas identifica cursos, una de frames identifica
                    MOMENTOS — "voy por acá". Un curso terminado no tiene
                    lección a medias, así que `reanudarEn` viene null y vuelve
                    sola a su portada. */}
                <div
                  className="relative aspect-video overflow-hidden rounded-uva-md bg-uva-surface-2 ring-1 ring-uva-divider transition-[box-shadow] group-hover:ring-uva-text-faint"
                  style={
                    !curso.reanudarEn && !esPortadaReal(curso.imagenPortada)
                      ? PORTADA_TRAMA
                      : undefined
                  }
                >
                  {curso.reanudarEn ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL firmada de Mux, de vida corta
                    <img
                      src={curso.reanudarEn.url}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : (
                    esPortadaReal(curso.imagenPortada) && (
                      <Image
                        src={curso.imagenPortada}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    )
                  )}
                  {/* Franja negra de siempre abajo de la portada (mismo
                      recurso que CursoCard.tsx del catálogo): "Completado" en
                      una esquina sin fondo se perdía sobre una portada clara
                      — acá el badge tiene garantizado el contraste debajo. */}
                  {curso.completado && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-5 pb-2">
                      <span className="rounded-uva-xs bg-uva-valid-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[.12em] text-uva-valid uppercase">
                        Completado
                      </span>
                    </div>
                  )}
                  {!curso.completado && curso.porcentaje === 100 && curso.examenRequerido && (
                    // Tercer estado, el que hacía falta al agregar exámenes:
                    // terminó las clases pero le falta aprobar el examen. Sin
                    // esto la tarjeta se veía igual que un curso a medias, sin
                    // pista de qué le falta para el certificado.
                    <div className="absolute inset-x-0 bottom-0 flex items-center bg-gradient-to-t from-black/80 to-transparent px-2.5 pt-5 pb-2">
                      <span className="rounded-uva-xs bg-uva-badge-warn-bg px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[.12em] text-uva-badge-warn-fg uppercase">
                        Examen pendiente
                      </span>
                    </div>
                  )}

                  {/* Dónde va DENTRO del video, igual que la barra del
                      reproductor: posición y duración. Va arriba a la derecha
                      para no chocar con el badge de estado ni con la barra.

                      Ojo con la distinción: esto NO es el avance del curso
                      —ese es "2/7 · 28%" en la línea de abajo— sino el minuto
                      exacto de la clase que dejó a medias. Un "00:22" suelto
                      no dice nada si no se sabe si el video dura uno o
                      cuarenta minutos, de ahí el "/ 04:15". */}
                  {curso.reanudarEn && (
                    <span className="absolute top-2 right-2 rounded-uva-xs bg-black/75 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-white">
                      {formatDuracion(curso.reanudarEn.segundo)}
                      {curso.reanudarEn.duracion
                        ? ` / ${formatDuracion(curso.reanudarEn.duracion)}`
                        : ""}
                    </span>
                  )}

                  {/* La barra del reproductor, a ras de la miniatura: de
                      borde a borde y pegada abajo, como en un reproductor de
                      verdad. El `overflow-hidden` del contenedor le recorta
                      las puntas con el mismo radio del frame, así que sigue
                      la forma de la imagen en vez de sobresalir. */}
                  {curso.reanudarEn && !!curso.reanudarEn.duracion && (
                    <div
                      className="absolute inset-x-0 bottom-0 h-[5px] bg-black/55"
                      role="progressbar"
                      aria-valuenow={porcentajeVisto(curso.reanudarEn)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Vas en el ${porcentajeVisto(curso.reanudarEn)}% de la clase`}
                    >
                      <div
                        className="h-full bg-uva-accent"
                        style={{ width: `${porcentajeVisto(curso.reanudarEn)}%` }}
                      />
                    </div>
                  )}
                </div>
                {/* Sin chip de categoría, a propósito. La categoría sirve
                    para DECIDIR qué tomar, que es el trabajo del Catálogo;
                    aquí ya son tus cursos y no estás eligiendo, estás
                    retomando. Además era el magenta más grande de la tarjeta
                    sin ser ni acción, ni estado activo, ni progreso — los
                    tres únicos usos que CLAUDE.md §3.3 le permite al acento. */}
                <div className="flex flex-1 flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <p className="line-clamp-2 text-[13.5px] leading-snug font-bold text-uva-text transition-colors group-hover:text-uva-accent">
                      {curso.titulo}
                    </p>
                    {/* Sin anillo en los completados: el badge COMPLETADO de
                        la miniatura ya lo dice, y un aro lleno de magenta al
                        lado repetía el mismo dato gritando. Misma razón por la
                        que tampoco llevan barra. */}
                    {curso.leccionesTotal > 0 && !curso.completado && (
                      <AnilloProgreso
                        porcentaje={curso.porcentaje}
                        etiqueta={`${curso.leccionesCompletadas} de ${curso.leccionesTotal} clases`}
                      />
                    )}
                  </div>

                  {/* Sin el "%": lo dice el anillo de al lado. Lo que el
                      anillo NO puede decir es de cuántas clases van, ni que
                      falta el examen. */}
                  {/* Pegado al título, sin `mt-auto`: ya no hace falta
                      empujarlo al fondo para alinear tarjetas vecinas —sin
                      marco, un borde inferior desparejo no se ve— y el conteo
                      pertenece al título, no al pie. */}
                  <p className="-mt-0.5 font-mono text-[11px] text-uva-text-faint tabular-nums">
                    {curso.leccionesCompletadas}/{curso.leccionesTotal} clases
                    {curso.examenRequerido && !curso.examenAprobado && " · falta el examen"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
