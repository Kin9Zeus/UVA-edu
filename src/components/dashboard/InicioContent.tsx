import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import Image from "next/image";
import { ArrowRight, ChevronRight, CirclePlay, Clock, Play } from "lucide-react";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { Button } from "@/components/ui/button";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import { NivelCurso } from "@/components/catalogo/CursoTarjetaPublica";
import { TuObra } from "@/components/dashboard/TuObra";
import { formatDuracion, formatHoras } from "@/lib/admin/format";
import { esPortadaReal } from "@/lib/media";
import type { CursoDeCategoria } from "@/lib/categoria";
import type { ClaseEnProgreso, CategoriaConConteo, ResumenObra } from "@/lib/dashboard";
import type { CursoDestacado } from "@/lib/cursoDestacado";


/** Fondo de una portada sin imagen: la retícula de lámina. */
const RETICULA =
  "bg-uva-surface-2 bg-[linear-gradient(color-mix(in_srgb,var(--uva-line-strong)_25%,transparent)_1px,transparent_1px),linear-gradient(90deg,color-mix(in_srgb,var(--uva-line-strong)_25%,transparent)_1px,transparent_1px)] bg-[size:24px_24px]";

function Barra({ porcentaje, etiqueta }: { porcentaje: number; etiqueta: string }) {
  return <Progress value={porcentaje} aria-label={etiqueta} />;
}

/** Portada de un curso: la imagen real o, sin ella, la retícula con su ícono. */
function Portada({
  imagen,
  claveCategoria,
  sizes,
  iconoClase = "size-14",
}: {
  imagen: string;
  claveCategoria?: string;
  sizes: string;
  iconoClase?: string;
}) {
  if (esPortadaReal(imagen)) {
    return <Image src={imagen} alt="" fill sizes={sizes} className="object-cover" />;
  }
  return (
    <span aria-hidden="true" className={`absolute inset-0 grid place-items-center ${RETICULA}`}>
      {claveCategoria && <IconoCategoria clave={claveCategoria} className={iconoClase} />}
    </span>
  );
}

function ContinuaDondeQuedaste({ clase }: { clase: ClaseEnProgreso }) {
  const href = `/cursos/${clase.cursoSlug}/${clase.leccionSlug}`;
  const avanceClase =
    clase.reanudarEn?.duracion && clase.reanudarEn.duracion > 0
      ? Math.min(100, Math.round((clase.reanudarEn.segundo / clase.reanudarEn.duracion) * 100))
      : 0;

  return (
    <section
      aria-labelledby="inicio-continua"
      className="grid min-w-0 gap-5 lg:self-start xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:gap-7"
    >
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-video self-center overflow-hidden rounded-uva-md border border-uva-divider bg-uva-surface-2"
      >
        {clase.reanudarEn ? (
          <MiniaturaMux
            src={clase.reanudarEn.url}
            className="absolute inset-0 size-full object-cover"
            respaldo={<Portada imagen={clase.imagenPortada} sizes="(max-width: 1279px) 100vw, 480px" />}
          />
        ) : (
          <Portada
            imagen={clase.imagenPortada}
            claveCategoria={clase.categorias[0]?.nombre}
            sizes="(max-width: 1279px) 100vw, 480px"
          />
        )}
        <span className="absolute inset-0 m-auto grid size-[76px] place-items-center rounded-full border-2 border-uva-on-accent bg-uva-btn text-uva-on-accent">
          <Play className="size-7 fill-current" aria-hidden="true" />
        </span>
        {clase.reanudarEn && (
          <span className="absolute bottom-4 left-2.5 rounded-uva-xs bg-uva-overlay/80 px-2 py-0.5 font-mono text-uva-detalle font-bold text-uva-on-accent">
            {formatDuracion(clase.reanudarEn.segundo)}
            {clase.reanudarEn.duracion ? ` / ${formatDuracion(clase.reanudarEn.duracion)}` : ""}
          </span>
        )}
        {avanceClase > 0 && (
          <span className="absolute inset-x-0 bottom-0 h-[5px] bg-uva-overlay/50">
            <span className="block h-full bg-uva-accent" style={{ width: `${avanceClase}%` }} />
          </span>
        )}
      </Link>

      <div className="flex min-w-0 flex-col justify-center gap-3 py-1">
        <div className="flex flex-col gap-2">
          <p className="text-uva-cuerpo font-semibold text-uva-text-muted">Continúa donde quedaste</p>
          <h2 id="inicio-continua" className="text-uva-titulo-4 font-extrabold text-balance text-uva-text sm:text-uva-titulo-3 xl:text-uva-titulo-4">
            {clase.leccionTitulo}
          </h2>
          <p className="text-uva-cuerpo text-uva-text-muted">{clase.cursoTitulo}</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="flex justify-between gap-3 text-uva-cuerpo">
            <span className="min-w-0 text-uva-text-muted">
              {clase.moduloTitulo}, clase {clase.numeroClase} de {clase.totalClases}
            </span>
            <span className="font-mono font-extrabold text-uva-text">{clase.progreso}%</span>
          </p>
          <Barra
            porcentaje={clase.progreso}
            etiqueta={`${clase.clasesCompletadas} de ${clase.totalClases} clases del curso`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <Button
            render={<Link href={href} />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="min-h-13 lg:min-h-12 gap-2 px-[30px] text-uva-cuerpo max-sm:w-full sm:w-auto"
          >
            <Play className="size-4 fill-current" aria-hidden="true" />
            Seguir la clase
          </Button>
          <Link
            href={`/cursos/${clase.cursoSlug}`}
            className="inline-flex min-h-11 items-center text-uva-cuerpo font-semibold text-uva-accent-ink underline underline-offset-4"
          >
            Ver temario
          </Link>
        </div>
      </div>
    </section>
  );
}

function ParaEmpezar({ curso }: { curso: CursoDestacado }) {
  return (
    <section
      aria-labelledby="inicio-empezar"
      className="grid min-w-0 gap-5 lg:self-start xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] xl:gap-7"
    >
      <div className="relative aspect-video self-start overflow-hidden rounded-uva-md border border-uva-divider">
        <Portada imagen={curso.imagenPortada} sizes="(max-width: 1279px) 100vw, 480px" />
      </div>
      <div className="flex min-w-0 flex-col justify-between gap-3 xl:h-0 xl:min-h-full">
        <div className="flex flex-col gap-2">
          <h2 id="inicio-empezar" className="text-uva-titulo-4 font-extrabold text-balance text-uva-text sm:text-uva-titulo-3 xl:text-uva-titulo-4">
            <span className="sr-only">Para empezar: </span>
            {curso.titulo}
          </h2>
          <p className="line-clamp-2 text-uva-cuerpo text-uva-text-muted">{curso.descripcion}</p>
          {curso.instructorNombre && (
            <p className="m-0 text-uva-cuerpo text-uva-text-muted">
              Dicta <span className="font-semibold text-uva-text">{curso.instructorNombre}</span>
            </p>
          )}
          <p className="m-0 flex flex-wrap items-center gap-x-5 gap-y-1.5 pt-1 text-uva-detalle font-semibold text-uva-text">
            <NivelCurso nivel={curso.nivel} />
            <span className="inline-flex items-center gap-2">
              <CirclePlay className="size-4 text-uva-text-muted" aria-hidden="true" />
              {curso.totalClases} {curso.totalClases === 1 ? "clase" : "clases"}
            </span>
            {curso.duracionTotalSegundos > 0 && (
              <span className="inline-flex items-center gap-2">
                <Clock className="size-4 text-uva-text-muted" aria-hidden="true" />
                {formatHoras(curso.duracionTotalSegundos)}
              </span>
            )}
          </p>
        </div>
        <Button
          render={<Link href={`/cursos/${curso.slug}`} />}
          nativeButton={false}
          variant="uva-primary"
          size="uva"
          className="min-h-13 lg:min-h-12 px-[30px] text-uva-cuerpo max-sm:w-full sm:w-auto sm:self-start"
        >
          Ver el curso
        </Button>
      </div>
    </section>
  );
}

function TambienEnProgreso({ clases }: { clases: ClaseEnProgreso[] }) {
  return (
    <section aria-labelledby="inicio-otros" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h2 id="inicio-otros" className="text-uva-titulo-4 text-uva-text">
          También en progreso
        </h2>
        <Link
          href="/dashboard/progreso"
          className="inline-flex min-h-11 items-center text-uva-detalle font-bold text-uva-accent-ink"
        >
          Ver todo tu progreso
        </Link>
      </div>
      <ul>
        {clases.map((clase, i) => (
          <li key={clase.leccionId}>
            <Link
              href={`/cursos/${clase.cursoSlug}/${clase.leccionSlug}`}
              className={`group grid grid-cols-[112px_minmax(0,1fr)] items-center gap-x-4 gap-y-2 px-1 py-3.5 no-underline hover:no-underline md:grid-cols-[160px_minmax(0,1fr)_200px_20px] md:gap-x-[22px] lg:px-2 ${i > 0 ? "border-t border-uva-divider" : ""}`}
            >
              <span className="relative block aspect-video overflow-hidden rounded-uva-md border border-uva-divider">
                {clase.reanudarEn ? (
                  <MiniaturaMux
                    src={clase.reanudarEn.url}
                    className="absolute inset-0 size-full object-cover"
                    respaldo={<Portada imagen={clase.imagenPortada} sizes="160px" iconoClase="size-8" />}
                  />
                ) : (
                  <Portada
                    imagen={clase.imagenPortada}
                    claveCategoria={clase.categorias[0]?.nombre}
                    sizes="160px"
                    iconoClase="size-8"
                  />
                )}
              </span>
              <span className="grid min-w-0">
                <span className="text-uva-cuerpo leading-snug font-bold text-uva-text group-hover:text-uva-accent-ink">
                  {clase.cursoTitulo}
                </span>
                <span className="text-uva-detalle text-uva-text-muted">
                  {clase.moduloTitulo}, {clase.clasesCompletadas} de {clase.totalClases} clases
                </span>
              </span>
              <span className="col-span-2 flex items-center gap-2.5 md:col-span-1">
                <span className="flex-1">
                  <Barra
                    porcentaje={clase.progreso}
                    etiqueta={`${clase.clasesCompletadas} de ${clase.totalClases} clases`}
                  />
                </span>
                <span className="font-mono text-uva-detalle font-bold text-uva-text">{clase.progreso}%</span>
              </span>
              <ArrowRight className="hidden size-5 text-uva-text-muted md:block" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Recomendados({ cursos }: { cursos: CursoDeCategoria[] }) {
  return (
    <section aria-labelledby="inicio-recomendados" className="flex flex-col gap-3.5">
      <h2 id="inicio-recomendados" className="text-uva-titulo-4 text-uva-text">
        Recomendados para ti
      </h2>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cursos.map((curso) => {
          const categoria = curso.categorias[0];
          return (
            <li key={curso.id}>
              <Link href={`/cursos/${curso.slug}`} className="group flex h-full flex-col no-underline hover:no-underline">
                <span className="relative block aspect-video overflow-hidden rounded-uva-md border border-uva-divider group-hover:border-uva-line-strong">
                  <Portada
                    imagen={curso.imagenPortada}
                    claveCategoria={categoria?.nombre}
                    sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 360px"
                  />
                </span>
                <span className="flex flex-1 flex-col gap-2 pt-3.5">
                  {/* Categoría a la izquierda y cuántas clases a la derecha. */}
                  <span className="flex items-center justify-between gap-3 text-uva-detalle text-uva-text-muted">
                    {categoria ? (
                      <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold">
                        <IconoCategoria clave={categoria.nombre} className="size-4" />
                        <span className="truncate">{categoria.nombre}</span>
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="shrink-0 font-mono">
                      {curso.totalClases} {curso.totalClases === 1 ? "clase" : "clases"}
                    </span>
                  </span>
                  <span className="text-uva-cuerpo font-bold text-uva-text group-hover:text-uva-accent-ink">
                    {curso.titulo}
                  </span>
                  {/* Instructor a la izquierda y nivel (las tres barras) a la
                      derecha, en la misma fila, como en el catálogo. */}
                  <span className="mt-auto flex items-center justify-between gap-3 border-t border-uva-divider pt-2.5 text-uva-detalle text-uva-text-muted">
                    <span className="min-w-0 truncate">{curso.instructorNombre}</span>
                    <NivelCurso nivel={curso.nivel} />
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function ExploraCategorias({ categorias }: { categorias: CategoriaConConteo[] }) {
  return (
    <section aria-labelledby="inicio-categorias" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="inicio-categorias" className="text-uva-titulo-4 text-uva-text">
          Explora por categoría
        </h2>
        <Link
          href="/dashboard/catalogo"
          className="inline-flex min-h-11 items-center gap-1.5 text-uva-detalle font-bold text-uva-accent-ink"
        >
          Ver catálogo
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      <ul className="grid border-t-[1.5px] border-uva-text sm:grid-cols-2">
        {categorias.map((categoria) => (
          <li key={categoria.id} className="border-b border-uva-divider sm:odd:border-r">
            <Link
              href={`/dashboard/catalogo/${categoria.slug}`}
              className="group flex min-h-16 items-center gap-3.5 px-3 py-2.5 no-underline hover:no-underline"
            >
              <IconoCategoria clave={categoria.slug} className="size-[30px]" />
              <span className="min-w-0 flex-1 text-uva-cuerpo font-extrabold text-uva-text group-hover:text-uva-accent-ink">
                {categoria.nombre}
              </span>
              <span className="font-mono text-uva-detalle text-uva-text-muted">
                {categoria.cursos} {categoria.cursos === 1 ? "curso" : "cursos"}
              </span>
              <ChevronRight className="size-4 text-uva-accent-ink" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function InicioContent({
  nombre,
  sigueAprendiendo,
  categorias,
  cursoDestacado,
  resumenObra,
  recomendados,
}: {
  nombre: string;
  sigueAprendiendo: ClaseEnProgreso[];
  categorias: CategoriaConConteo[];
  cursoDestacado: CursoDestacado | null;
  resumenObra: ResumenObra;
  recomendados: CursoDeCategoria[];
}) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;
  const [actual, ...otros] = sigueAprendiendo;

  return (
    <div className="mx-auto flex w-full max-w-uva flex-col gap-9 px-uva-margen py-7 lg:py-9">
      <div>
        <h1 className="text-uva-titulo-3 text-balance text-uva-text">Hola {primerNombre}, tienes metas que alcanzar.</h1>
        <p className="mt-2 text-uva-lead text-uva-text-muted">Retoma donde quedaste o explora algo nuevo del gremio.</p>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]">
        {actual ? (
          <ContinuaDondeQuedaste clase={actual} />
        ) : cursoDestacado ? (
          <ParaEmpezar curso={cursoDestacado} />
        ) : (
          <section className="flex flex-col justify-center gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-6">
            <h2 className="text-uva-titulo-4 text-uva-text">Todavía no tienes cursos en progreso</h2>
            <p className="text-uva-cuerpo text-uva-text-muted">Elige uno en el catálogo y arranca con la primera clase.</p>
            <Button
              render={<Link href="/dashboard/catalogo" />}
              nativeButton={false}
              variant="uva-primary"
              size="uva"
              className="min-h-12 text-uva-cuerpo sm:w-auto sm:self-start"
            >
              Ver el catálogo
            </Button>
          </section>
        )}
        <TuObra resumen={resumenObra} />
      </div>

      {otros.length > 0 && <TambienEnProgreso clases={otros.slice(0, 3)} />}
      {recomendados.length > 0 && <Recomendados cursos={recomendados} />}
      {categorias.length > 0 && <ExploraCategorias categorias={categorias} />}
    </div>
  );
}
