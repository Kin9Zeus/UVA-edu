"use client";

import { Progress } from "@/components/ui/progress";
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Award, Check, Flame, Play } from "lucide-react";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { Button } from "@/components/ui/button";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { esPortadaReal } from "@/lib/media";
import type { CursoConProgreso, ProgresoData } from "@/lib/progreso";

type Filtro = "todos" | "en_progreso" | "completados";
type Orden = "recientes" | "porcentaje";

const FILTROS: { valor: Filtro; etiqueta: string }[] = [
  { valor: "todos", etiqueta: "Todos" },
  { valor: "en_progreso", etiqueta: "En progreso" },
  { valor: "completados", etiqueta: "Completados" },
];

const ZONA = "America/Bogota";
const DIA = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA });
const FECHA_CORTA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  timeZone: ZONA,
});
const FECHA_LARGA = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: ZONA,
});

/** "18 sept 2026" (sin los "de" ni el punto de es-CO). */
function fechaLarga(iso: string) {
  const partes = FECHA_LARGA.formatToParts(new Date(iso));
  const parte = (tipo: string) =>
    partes.find((p) => p.type === tipo)?.value.replace(".", "") ?? "";
  return `${parte("day")} ${parte("month")} ${parte("year")}`;
}

/** "21 sep" para el lunes de una semana ("AAAA-MM-DD"). */
function fechaCorta(dia: string) {
  return FECHA_CORTA.format(new Date(`${dia}T12:00:00Z`))
    .replace(".", "")
    .replace(" de ", " ");
}

/** "hoy", "ayer" o "hace N días", contando días de Bogotá respecto a `hoy`. */
function haceCuanto(iso: string, hoy: string) {
  const dias = Math.round(
    (new Date(`${hoy}T12:00:00Z`).getTime() -
      new Date(`${DIA.format(new Date(iso))}T12:00:00Z`).getTime()) /
      86_400_000,
  );
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  return `hace ${dias} días`;
}

/** "3 h 20 min", "45 min" o "0 min". */
function duracionTexto(segundos: number) {
  const minutos = Math.round(segundos / 60);
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const RETICULA =
  "bg-uva-surface-2 bg-[linear-gradient(color-mix(in_srgb,var(--uva-line-strong)_25%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--uva-line-strong)_25%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]";

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex flex-col-reverse px-[22px] py-[18px]">
      <dt className="mt-0.5 text-uva-detalle text-uva-text-muted">
        {etiqueta}
      </dt>
      <dd className="font-mono text-uva-titulo-3 text-uva-text">{valor}</dd>
    </div>
  );
}

function Actividad({
  actividad,
}: {
  actividad: NonNullable<ProgresoData["actividad"]>;
}) {
  const { racha, semanas } = actividad;
  const actual = semanas[semanas.length - 1];
  const promedio =
    semanas.reduce((total, semana) => total + semana.dias, 0) / semanas.length;
  const promedioTexto = Number.isInteger(promedio)
    ? String(promedio)
    : promedio.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  const etiqueta = (semana: (typeof semanas)[number]) =>
    semana.esActual ? "Esta semana" : fechaCorta(semana.inicio);

  return (
    <section
      aria-labelledby="progreso-actividad"
      className="flex flex-col gap-5 border-t border-uva-divider py-5 lg:flex-row lg:items-center lg:gap-12"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h2 id="progreso-actividad" className="text-uva-titulo-4 text-uva-text">
          Tu actividad
        </h2>
        <p className="text-uva-detalle text-uva-text-muted">
          Días por semana en que viste al menos una clase.
        </p>
        <p className="mt-1.5 flex items-center gap-2 text-uva-cuerpo font-bold text-uva-text">
          <Flame className="size-5 text-uva-accent-2-text" aria-hidden="true" />
          {racha === 0
            ? "Sin racha por ahora"
            : `Racha de ${racha} ${racha === 1 ? "día" : "días"}`}
        </p>
        <p className="text-uva-detalle text-uva-text-muted">
          {actual.dias === 0 ? (
            "Esta semana todavía no has visto clases."
          ) : (
            <>
              Esta semana llevas{" "}
              <strong className="text-uva-text">
                {actual.dias} {actual.dias === 1 ? "día" : "días"}
              </strong>
              .
            </>
          )}{" "}
          En el último mes, tu promedio es de {promedioTexto}{" "}
          {promedio === 1 ? "día" : "días"} por semana.
        </p>
      </div>
      <div className="w-full lg:w-[400px] lg:shrink-0">
        <div
          role="img"
          aria-label={`Días con clases por semana en el último mes: ${semanas
            .map((semana) => `${etiqueta(semana)}: ${semana.dias} de 7`)
            .join("; ")}`}
          className="flex items-end gap-3 lg:gap-5"
        >
          {semanas.map((semana) => (
            <div
              key={semana.inicio}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span
                className={`font-mono text-uva-detalle ${semana.esActual ? "font-extrabold text-uva-text" : "font-semibold text-uva-text-muted"}`}
              >
                {semana.dias}{" "}
                <span className="font-normal text-uva-text-muted">de 7</span>
              </span>
              <span className="relative h-28 w-full max-w-[52px] rounded-uva-sm bg-[color-mix(in_srgb,var(--uva-divider)_60%,transparent)]">
                <span
                  className={`absolute inset-x-0 bottom-0 rounded-uva-sm ${semana.esActual ? "bg-uva-accent-2 shadow-[inset_0_0_0_1px_var(--uva-maqueta-arista)]" : "bg-uva-line-strong"}`}
                  style={{ height: `${(semana.dias / 7) * 100}%` }}
                />
              </span>
              <span
                className={`text-center text-uva-detalle whitespace-nowrap ${semana.esActual ? "font-bold text-uva-text" : "text-uva-text-muted"}`}
              >
                {etiqueta(semana)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-uva-detalle text-uva-text-muted">
          Último mes. Cada barra es una semana: la parte llena son los días en
          que viste al menos una clase.
        </p>
      </div>
    </section>
  );
}

function Estado({ curso }: { curso: CursoConProgreso }) {
  if (curso.completado) {
    return (
      <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full bg-uva-accent-2 px-2.5 text-uva-detalle font-bold text-uva-on-bright">
        <Check className="size-3" strokeWidth={3} aria-hidden="true" />
        Completado
      </span>
    );
  }
  if (curso.porcentaje === 100 && curso.examenRequerido) {
    return (
      <span className="inline-flex min-h-[26px] items-center rounded-full bg-uva-badge-warn-bg px-2.5 text-uva-detalle font-bold text-uva-badge-warn-fg">
        Examen pendiente
      </span>
    );
  }
  return (
    <span className="inline-flex min-h-[26px] items-center rounded-full bg-uva-accent-soft px-2.5 text-uva-detalle font-bold text-uva-accent-ink">
      En progreso
    </span>
  );
}

function FilaCurso({ curso, hoy }: { curso: CursoConProgreso; hoy: string }) {
  const hrefCurso = `/cursos/${curso.cursoSlug}`;
  const hrefSeguir = curso.siguienteLeccionSlug
    ? `${hrefCurso}/${curso.siguienteLeccionSlug}`
    : hrefCurso;

  return (
    <li className="flex flex-col gap-[18px] border-t border-uva-divider pt-[18px] pb-4 md:flex-row md:items-center">
      <Link
        href={curso.completado ? hrefCurso : hrefSeguir}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-video w-full overflow-hidden rounded-uva-md border border-uva-divider md:w-[200px] md:shrink-0"
      >
        {curso.reanudarEn ? (
          <MiniaturaMux
            src={curso.reanudarEn.url}
            className="absolute inset-0 size-full object-cover"
          />
        ) : esPortadaReal(curso.imagenPortada) ? (
          <Image
            src={curso.imagenPortada}
            alt=""
            fill
            sizes="(max-width: 767px) 100vw, 200px"
            className="object-cover"
          />
        ) : (
          <span
            className={`absolute inset-0 grid place-items-center ${RETICULA}`}
          >
            {curso.categoria && (
              <IconoCategoria clave={curso.categoria} className="size-14" />
            )}
          </span>
        )}
        {!curso.completado && curso.porcentaje > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-1 bg-uva-overlay/35">
            <span
              className="block h-full bg-uva-btn"
              style={{ width: `${curso.porcentaje}%` }}
            />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Estado curso={curso} />
          {curso.categoria && (
            <span className="inline-flex items-center gap-1.5 text-uva-detalle text-uva-text-muted">
              <IconoCategoria clave={curso.categoria} className="size-3.5" />
              {curso.categoria}
            </span>
          )}
        </div>
        <h3 className="text-uva-cuerpo leading-snug font-extrabold text-uva-text">
          {curso.titulo}
        </h3>
        <div className="flex items-center gap-3">
          <Progress
            value={curso.porcentaje}
            aria-label={`${curso.leccionesCompletadas} de ${curso.leccionesTotal} clases`}
            className="flex-1"
          />
          <span className="font-mono text-uva-detalle font-bold text-uva-text">
            {curso.leccionesCompletadas}/{curso.leccionesTotal} clases
          </span>
        </div>
        {curso.certificadoEmitido ? (
          <p className="font-mono text-uva-detalle text-uva-text-muted">
            Terminado el {fechaLarga(curso.certificadoEmitido)}
          </p>
        ) : (
          curso.ultimaActividad && (
            <p className="font-mono text-uva-detalle text-uva-text-muted">
              Última clase {haceCuanto(curso.ultimaActividad, hoy)}
            </p>
          )
        )}
        <div className="mt-1 max-md:w-full">
          {curso.completado ? (
            <Button
              render={
                <Link
                  href={
                    curso.certificadoEmitido
                      ? "/dashboard/certificados"
                      : hrefCurso
                  }
                />
              }
              nativeButton={false}
              variant="uva-secondary"
              size="uva"
              className="min-h-11.25 gap-2 text-uva-cuerpo max-md:w-full md:pointer-fine:h-9 md:pointer-fine:min-h-9 md:w-auto md:px-4 md:pointer-fine:text-uva-detalle"
            >
              {curso.certificadoEmitido ? (
                <>
                  <Award className="size-[18px]" aria-hidden="true" />
                  Ver certificado
                </>
              ) : (
                "Ver curso"
              )}
            </Button>
          ) : (
            <Button
              render={<Link href={hrefSeguir} />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="min-h-11.25 gap-2 text-uva-cuerpo max-md:w-full md:pointer-fine:h-9 md:pointer-fine:min-h-9 md:w-auto md:px-4 md:pointer-fine:text-uva-detalle"
            >
              <Play className="size-4 fill-current" aria-hidden="true" />
              Continuar
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

export function ProgresoContent({
  data,
  hoy,
}: {
  data: ProgresoData;
  hoy: string;
}) {
  const { cursos, actividad } = data;
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
    // `cursos` ya llega ordenado por actividad reciente (vista
    // progreso_cursos_estudiante): "recientes" no reordena nada.
    return orden === "porcentaje"
      ? [...filtrados].sort((a, b) => b.porcentaje - a.porcentaje)
      : filtrados;
  }, [cursos, filtro, orden]);

  const terminados = cursos.filter((curso) => curso.completado).length;
  const clasesVistas = cursos.reduce(
    (total, curso) => total + curso.leccionesCompletadas,
    0,
  );
  const segundosVistos = cursos.reduce(
    (total, curso) => total + curso.segundosVistos,
    0,
  );

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-9 px-uva-margen py-7 lg:py-9">
      <div>
        <h1 className="text-uva-titulo-3 text-uva-text">Tu progreso</h1>
        <p className="mt-2 text-uva-lead text-uva-text-muted">
          Lo que llevas, lo que terminaste y tu ritmo de estudio.
        </p>
      </div>

      <dl className="-mt-3 grid grid-cols-2 border-t border-uva-divider pt-5 lg:grid-cols-4 [&>div:nth-child(even)]:border-l lg:[&>div:not(:first-child)]:border-l [&>div]:border-uva-divider">
        <Cifra
          valor={String(cursos.length)}
          etiqueta={cursos.length === 1 ? "curso inscrito" : "cursos inscritos"}
        />
        <Cifra
          valor={String(terminados)}
          etiqueta={terminados === 1 ? "terminado" : "terminados"}
        />
        <Cifra
          valor={String(clasesVistas)}
          etiqueta={clasesVistas === 1 ? "clase vista" : "clases vistas"}
        />
        <Cifra
          valor={duracionTexto(segundosVistos)}
          etiqueta="de clases vistas"
        />
      </dl>

      {actividad ? (
        <Actividad actividad={actividad} />
      ) : (
        <p className="border-t border-uva-divider pt-5 text-uva-detalle text-uva-text-muted">
          No pudimos cargar tu actividad de estudio. Recarga la página para
          intentarlo de nuevo.
        </p>
      )}

      <section
        aria-labelledby="progreso-cursos"
        className="flex flex-col gap-3.5"
      >
        <h2 id="progreso-cursos" className="text-uva-titulo-4 text-uva-text">
          Tus cursos
        </h2>

        {cursos.length > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <div
              role="group"
              aria-label="Filtrar cursos"
              className="inline-flex gap-0.5 rounded-full border border-uva-divider bg-uva-surface p-0.5"
            >
              {FILTROS.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={filtro === opcion.valor}
                  onClick={() => setFiltro(opcion.valor)}
                  className={`min-h-11 rounded-full px-4 text-uva-detalle transition-colors md:pointer-fine:min-h-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent ${
                    filtro === opcion.valor
                      ? "bg-uva-btn font-bold text-uva-on-accent"
                      : "font-semibold text-uva-text-muted hover:text-uva-text"
                  }`}
                >
                  {opcion.etiqueta}
                </button>
              ))}
            </div>
            <Select
              value={orden}
              onValueChange={(valor) => setOrden(valor as Orden)}
              items={{
                recientes: "Más recientes",
                porcentaje: "Más avanzados",
              }}
            >
              <SelectTrigger
                className="min-h-11 rounded-uva-md border-uva-divider bg-uva-surface text-uva-detalle font-semibold md:pointer-fine:h-9 md:pointer-fine:min-h-9"
                aria-label="Ordenar cursos"
              >
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
          <div className="flex flex-col items-start gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-6">
            <p className="text-uva-cuerpo text-uva-text-muted">
              Todavía no has empezado ningún curso. Explora el catálogo para
              arrancar.
            </p>
            <Button
              render={<Link href="/dashboard/catalogo" />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="min-h-11.25 text-uva-cuerpo sm:w-auto md:pointer-fine:h-9 md:pointer-fine:min-h-9 md:px-4 md:pointer-fine:text-uva-detalle"
            >
              Ver catálogo
            </Button>
          </div>
        ) : cursosVisibles.length === 0 ? (
          <p className="py-6 text-uva-cuerpo text-uva-text-muted">
            No tienes cursos{" "}
            {filtro === "completados" ? "completados" : "en progreso"} todavía.
          </p>
        ) : (
          <ul className="flex flex-col border-b border-uva-divider">
            {cursosVisibles.map((curso) => (
              <FilaCurso key={curso.cursoId} curso={curso} hoy={hoy} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
