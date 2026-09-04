"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { esPortadaReal } from "@/lib/media";
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

export function ProgresoContent({ data }: { data: ProgresoData }) {
  const { cursos } = data;
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [orden, setOrden] = useState<Orden>("recientes");

  const cursosVisibles = useMemo(() => {
    const filtrados = cursos.filter((curso) => {
      if (filtro === "en_progreso") return curso.porcentaje < 100;
      if (filtro === "completados") return curso.porcentaje === 100;
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
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-[clamp(20px,3vw,44px)] py-8">
      <h1 className="text-2xl text-uva-text">Tu progreso</h1>

      <div className="rounded-uva-md border border-uva-divider bg-uva-surface p-6">
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
          <div className="flex flex-col items-center gap-3 py-10 text-center">
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
                className="group flex flex-col overflow-hidden rounded-uva-md border border-uva-divider bg-uva-bg hover:border-uva-text-faint"
              >
                <div
                  className="relative aspect-video"
                  style={esPortadaReal(curso.imagenPortada) ? undefined : PORTADA_TRAMA}
                >
                  {esPortadaReal(curso.imagenPortada) && (
                    // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage
                    <img
                      src={curso.imagenPortada}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                  )}
                  {curso.porcentaje === 100 && (
                    <span className="absolute top-2.5 right-2.5 rounded-uva-xs bg-uva-valid-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.12em] text-uva-valid uppercase">
                      Completado
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 p-3.5">
                  {/* min-h reserva 2 líneas completas de chips (19.5px cada
                      una + 4px de gap-1, medido en DOM): un curso con 1
                      sola categoría no debe dejar la barra de progreso más
                      arriba que una vecina con 2 categorías que envuelven. */}
                  <div className="flex min-h-[43px] flex-wrap items-start gap-1">
                    {curso.categorias.map((categoria) => (
                      <span
                        key={categoria.id}
                        className="rounded-uva-xs bg-uva-accent-soft px-2 py-0.5 text-[10px] whitespace-nowrap text-uva-accent-text"
                      >
                        {categoria.nombre}
                      </span>
                    ))}
                  </div>
                  <p className="line-clamp-2 min-h-[2.75em] text-[13.5px] leading-snug font-bold text-uva-text">
                    {curso.titulo}
                  </p>
                  <Progress value={curso.porcentaje} />
                  <p className="font-mono text-[11px] text-uva-text-faint tabular-nums">
                    {curso.leccionesCompletadas}/{curso.leccionesTotal} · {curso.porcentaje}%
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
