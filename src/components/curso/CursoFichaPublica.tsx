import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Lock, Play } from "lucide-react";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { EstrellasCalificacion } from "@/components/curso/EstrellasCalificacion";
import { ResenasPublicas } from "@/components/curso/ResenasPublicas";
import {
  BarrasNivel,
  NIVEL,
  RETICULA,
} from "@/components/catalogo/CursoTarjetaPublica";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import { formatFecha, formatHoras } from "@/lib/admin/format";
import { esPortadaReal } from "@/lib/media";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { SIN_INSTRUCTOR } from "@/lib/instructores";
import { cn } from "@/lib/utils";
import type { CursoPublico, LeccionPublica } from "@/lib/curso";
import type { CalificacionesCurso } from "@/lib/curso-calificaciones";

/** "4,7": coma decimal y siempre un decimal, como se lee en español. */
const formatPromedio = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
}).format;

/** Duración de una clase como se lee en un reproductor: `3:20`, `1:02:05`. `null` si no hay video listo. */
function duracionClase(segundos: number | null): string | null {
  if (segundos === null || segundos <= 0) return null;
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = String(segundos % 60).padStart(2, "0");
  return horas > 0
    ? `${horas}:${String(minutos).padStart(2, "0")}:${resto}`
    : `${minutos}:${resto}`;
}

function iniciales(nombre: string) {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? "")
      .join("") || "U"
  );
}

function plural(n: number, singular: string, varias: string) {
  return `${n} ${n === 1 ? singular : varias}`;
}

/**
 * Una clase del temario. Sin sesión solo la vista previa es enlace; las demás
 * llevan candado y no se pueden abrir.
 */
function FilaClase({
  leccion,
  numero,
  cursoSlug,
  esVistaPrevia,
}: {
  leccion: LeccionPublica;
  numero: number;
  cursoSlug: string;
  esVistaPrevia: boolean;
}) {
  const duracion = duracionClase(leccion.duracion);

  const contenido = (
    <>
      {/* Columna del número: el círculo tapa la línea vertical del módulo. */}
      <span className="grid w-7.5 shrink-0 place-items-center md:w-11">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full font-mono text-xs font-extrabold",
            esVistaPrevia
              ? "bg-uva-btn text-uva-on-accent ring-4 ring-uva-accent-soft"
              : "border-2 border-uva-line-strong bg-uva-bg text-uva-text",
          )}
        >
          {numero}
        </span>
      </span>

      <span
        className={cn(
          "relative block h-9 w-16 shrink-0 overflow-hidden rounded-uva-xs bg-uva-surface-2 md:h-13.5 md:w-24",
          esVistaPrevia
            ? "outline-2 outline-offset-1 outline-uva-btn"
            : "border border-uva-divider",
        )}
      >
        {leccion.miniaturaUrl && (
          <MiniaturaMux
            src={leccion.miniaturaUrl}
            loading="lazy"
            className={cn(
              "absolute inset-0 size-full object-cover",
              !esVistaPrevia && "opacity-50",
            )}
          />
        )}
        <span className="absolute inset-0 grid place-items-center">
          <span
            className={cn(
              "grid size-6 place-items-center rounded-full text-uva-on-accent",
              esVistaPrevia ? "bg-uva-btn" : "bg-uva-overlay",
            )}
          >
            {esVistaPrevia ? (
              <Play
                className="size-3 fill-current"
                strokeWidth={0}
                aria-hidden
              />
            ) : (
              <Lock className="size-3" strokeWidth={2.4} aria-hidden />
            )}
          </span>
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-uva-cuerpo leading-snug",
            esVistaPrevia
              ? "font-bold text-uva-text"
              : "font-medium text-uva-text-muted",
          )}
        >
          {leccion.titulo}
          {!esVistaPrevia && <span className="sr-only"> (bloqueada)</span>}
        </span>
        {esVistaPrevia && (
          <span className="block text-uva-detalle font-bold text-uva-accent-ink">
            Vista previa gratis
          </span>
        )}
      </span>

      {duracion && (
        <span className="shrink-0 font-mono text-uva-detalle text-uva-text-muted">
          <span className="sr-only">Duración </span>
          {duracion}
        </span>
      )}
    </>
  );

  const clases =
    "flex min-h-15 items-center gap-2.5 rounded-uva-sm py-1 md:min-h-17.5 md:gap-4";

  return (
    <li className="relative">
      {esVistaPrevia ? (
        <Link
          href={`/cursos/${cursoSlug}/${leccion.slug}`}
          className={cn(
            clases,
            "bg-uva-accent-soft pr-2 shadow-[inset_3px_0_0_var(--uva-btn)] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
          )}
        >
          {contenido}
        </Link>
      ) : (
        <div className={clases}>{contenido}</div>
      )}
    </li>
  );
}

/**
 * Ficha de un curso para un visitante sin sesión (`/cursos/[slug]`), dirección
 * visual "Maqueta" (artboard "Curso" del canvas "UVA Cursos").
 *
 * El diseño está hecho con sesión; sin ella cambia esto:
 * - Solo la primera clase se puede ver (vista previa pública, igual que
 *   `lib/leccion.ts`), y solo si el curso tiene más de una clase: de una sola
 *   clase, esa clase ES el curso. Las demás llevan candado.
 * - No hay avance: los módulos dicen cuántas clases tienen, no "3/3".
 * - Sin tarjeta de examen final: el examen no es contenido público.
 * - Reseñas de solo lectura (`ResenasPublicas`).
 *
 * La ficha con sesión sigue en `CursoDetalleContent`.
 *
 * Orden del HTML = orden en celular (título, portada y botones, descripción,
 * temario, instructor, reseñas). En escritorio la cuadrícula sube la portada a
 * la columna derecha, así el teclado y el lector de pantalla siguen el mismo
 * recorrido en los dos tamaños.
 */
export function CursoFichaPublica({
  curso,
  calificaciones,
}: {
  curso: CursoPublico;
  calificaciones: CalificacionesCurso;
}) {
  const modulos = curso.modulos.filter((modulo) => modulo.lecciones.length > 0);
  const primeraLeccion = modulos[0]?.lecciones[0];
  const vistaPrevia = curso.totalClases > 1 ? primeraLeccion : undefined;
  const rutaVistaPrevia = vistaPrevia
    ? `/cursos/${curso.slug}/${vistaPrevia.slug}`
    : null;
  const rutaEntrar = `/login?redirect=/cursos/${curso.slug}`;

  const categoria = curso.categorias[0];
  const nivel = NIVEL[curso.nivel];
  const instructores =
    curso.instructores.length > 0 ? curso.instructores : null;
  const duracionTotal =
    curso.duracionTotalSegundos > 0
      ? formatHoras(curso.duracionTotalSegundos)
      : null;
  const conPortada = esPortadaReal(curso.imagenPortada);
  const notaAcceso = PRECIOS_HABILITADOS
    ? "Las demás clases se abren con tu suscripción."
    : "Las demás clases se abren con tu código de invitación.";

  // Numeración corrida en todo el curso (1…N), como el reproductor.
  const numeroDeClase = new Map(
    modulos
      .flatMap((modulo) => modulo.lecciones)
      .map((leccion, indice) => [leccion.id, indice + 1]),
  );

  const portada = (
    <figure
      className="relative aspect-video overflow-hidden rounded-uva-md border border-uva-divider bg-uva-surface-2 lg:rounded-uva-lg"
      style={conPortada ? undefined : RETICULA}
    >
      {conPortada ? (
        <Image
          src={curso.imagenPortada}
          alt=""
          fill
          sizes="(max-width: 1023px) 92vw, 440px"
          loading="eager"
          fetchPriority="high"
          className="object-cover"
        />
      ) : (
        categoria && (
          <span className="absolute inset-0 grid place-items-center">
            <IconoCategoria
              clave={categoria.nombre}
              grosor={5}
              className="size-16"
            />
          </span>
        )
      )}
      {rutaVistaPrevia && (
        <span className="absolute inset-0 grid place-items-center">
          <span className="grid size-14 place-items-center rounded-full bg-uva-btn text-uva-on-accent shadow-lg">
            <Play
              className="ml-0.5 size-6 fill-current"
              strokeWidth={0}
              aria-hidden
            />
          </span>
        </span>
      )}
    </figure>
  );

  return (
    <div className="mx-auto max-w-uva px-uva-margen pt-4 pb-uva-seccion lg:pt-8">
      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_440px] lg:grid-rows-[auto_1fr_auto_auto] lg:gap-x-14 lg:gap-y-4">
        {/* Encabezado: ruta, título y datos del curso. */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1 lg:gap-4">
          <nav aria-label="Ruta de navegación">
            <ol className="flex flex-wrap items-center gap-x-2 text-uva-detalle text-uva-text-muted">
              <li>
                <Link
                  href="/catalogo"
                  className="inline-flex min-h-11 items-center font-bold text-uva-accent-ink hover:underline"
                >
                  Catálogo
                </Link>
              </li>
              {categoria && (
                <li className="flex items-center gap-x-2">
                  <ChevronRight
                    className="size-4"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <Link
                    href={`/catalogo/${categoria.slug}`}
                    className="inline-flex min-h-11 items-center text-uva-text-muted hover:text-uva-text hover:underline"
                  >
                    {categoria.nombre}
                  </Link>
                </li>
              )}
            </ol>
          </nav>

          <h1 className="m-0 text-uva-titulo-2 text-balance text-uva-text lg:text-uva-titulo-3">
            {curso.titulo}
          </h1>

          <div className="flex flex-col gap-1 font-mono text-uva-detalle text-uva-text-muted">
            <p className="m-0 flex flex-wrap items-center gap-x-4.5 gap-y-1">
              {calificaciones.total > 0 && (
                <a
                  href="#reseñas"
                  className="inline-flex min-h-11 items-center gap-2 text-uva-text hover:no-underline"
                  aria-label={
                    calificaciones.promedio !== null
                      ? `Calificación ${formatPromedio(calificaciones.promedio)} de 5, ${plural(calificaciones.total, "reseña", "reseñas")}. Ir a las reseñas`
                      : `${plural(calificaciones.total, "reseña", "reseñas")}. Ir a las reseñas`
                  }
                >
                  <span aria-hidden="true" className="contents">
                    {calificaciones.promedio !== null && (
                      <>
                        <span className="text-uva-cuerpo font-extrabold">
                          {formatPromedio(calificaciones.promedio)}
                        </span>
                        <EstrellasCalificacion
                          puntuacion={calificaciones.promedio}
                          size={15}
                        />
                      </>
                    )}
                    <span className="text-uva-text-muted underline underline-offset-3">
                      {plural(calificaciones.total, "reseña", "reseñas")}
                    </span>
                  </span>
                </a>
              )}
              <span className="inline-flex min-h-11 items-center gap-2 font-semibold text-uva-text">
                <BarrasNivel nivel={curso.nivel} />
                <span>
                  <span className="sr-only">Nivel </span>
                  {nivel.etiqueta}
                </span>
              </span>
            </p>
            <p className="m-0 flex flex-wrap gap-x-4.5 gap-y-1">
              <span>
                {instructores
                  ? instructores.map((i) => i.nombre).join(", ")
                  : SIN_INSTRUCTOR}
              </span>
              <span>{plural(curso.totalClases, "clase", "clases")}</span>
              {duracionTotal && <span>{duracionTotal}</span>}
            </p>
          </div>
        </div>

        {/* Portada y botones: columna derecha en escritorio. */}
        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:gap-5">
          {rutaVistaPrevia ? (
            // La portada repite el destino del botón de abajo: fuera del orden
            // del teclado y del lector para no anunciar dos veces lo mismo.
            <Link
              href={rutaVistaPrevia}
              tabIndex={-1}
              aria-hidden="true"
              className="block"
            >
              {portada}
            </Link>
          ) : (
            portada
          )}

          {rutaVistaPrevia && vistaPrevia ? (
            <Link
              href={rutaVistaPrevia}
              className="flex min-h-16 w-full flex-col items-center justify-center gap-0.5 rounded-uva-md bg-uva-btn px-4.5 py-2.5 text-center text-uva-cuerpo leading-tight font-semibold text-uva-on-accent hover:bg-uva-btn-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
            >
              Ver la primera clase gratis
              <small className="block w-full min-w-0 truncate text-uva-detalle font-medium">
                Clase 1, {vistaPrevia.titulo}
              </small>
            </Link>
          ) : null}

          <Link
            href={rutaEntrar}
            className={cn(
              "flex min-h-13 w-full items-center justify-center rounded-uva-md px-5 text-center text-uva-cuerpo font-semibold hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
              rutaVistaPrevia
                ? "-mt-2 border-[1.5px] border-uva-line-strong text-uva-text hover:border-uva-text"
                : "bg-uva-btn text-uva-on-accent hover:bg-uva-btn-hover",
            )}
          >
            Entra o crea tu cuenta
          </Link>
          <p className="m-0 -mt-1 text-center text-uva-detalle text-uva-text-muted">
            {notaAcceso}
          </p>
        </div>

        {/* Descripción. */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-2">
          <p className="m-0 max-w-prose text-uva-cuerpo text-uva-text">
            {curso.descripcion}
          </p>
          <p className="m-0 font-mono text-uva-detalle text-uva-text-muted">
            Actualizado el {formatFecha(curso.fechaEdicion)}
          </p>
        </div>

        {/* Temario. */}
        <section
          aria-labelledby="temario-titulo"
          className="flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-3 lg:mt-6"
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2
                id="temario-titulo"
                className="m-0 text-uva-titulo-4 text-uva-text"
              >
                Temario
              </h2>
              <p className="m-0 flex flex-wrap gap-x-3 font-mono text-uva-detalle text-uva-text-muted">
                <span>{plural(modulos.length, "módulo", "módulos")}</span>
                <span>{plural(curso.totalClases, "clase", "clases")}</span>
                {duracionTotal && <span>{duracionTotal}</span>}
              </p>
            </div>
            {curso.totalClases > 0 && (
              <p className="m-0 text-uva-detalle text-uva-text-muted">
                {vistaPrevia
                  ? "La primera clase es gratis y no necesita cuenta."
                  : "Entra con tu cuenta para ver las clases."}
              </p>
            )}
          </div>

          {modulos.length === 0 ? (
            <p className="m-0 rounded-uva-md border border-uva-divider bg-uva-surface p-5 text-uva-cuerpo text-uva-text-muted">
              Este curso todavía no tiene clases publicadas.
            </p>
          ) : (
            <ol className="border-b border-uva-divider">
              {modulos.map((modulo, indiceModulo) => (
                <li
                  key={modulo.id}
                  className="border-t border-uva-divider pt-3.5 pb-2.5"
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      aria-hidden="true"
                      className="grid size-10 shrink-0 place-items-center rounded-uva-md border-[1.5px] border-uva-text bg-uva-surface-2 font-mono text-uva-cuerpo font-extrabold text-uva-text md:size-11"
                    >
                      {String(indiceModulo + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <span className="block text-uva-detalle text-uva-text-muted">
                        Módulo {indiceModulo + 1} de {modulos.length}
                      </span>
                      <h3 className="m-0 text-uva-cuerpo leading-snug font-bold text-uva-text">
                        {modulo.titulo}
                      </h3>
                    </div>
                    <span className="shrink-0 font-mono text-uva-detalle font-bold text-uva-text-muted">
                      {plural(modulo.lecciones.length, "clase", "clases")}
                    </span>
                  </div>

                  <ol className="relative flex flex-col pt-1">
                    {/* Línea que une los números de las clases del módulo. */}
                    <span
                      aria-hidden="true"
                      className="absolute top-5.5 bottom-5.5 left-3.5 w-0.5 bg-uva-divider md:left-5.25"
                    />
                    {modulo.lecciones.map((leccion) => (
                      <FilaClase
                        key={leccion.id}
                        leccion={leccion}
                        numero={numeroDeClase.get(leccion.id) ?? 0}
                        cursoSlug={curso.slug}
                        esVistaPrevia={leccion.id === vistaPrevia?.id}
                      />
                    ))}
                  </ol>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Instructor. Sin profesor asignado no hay tarjeta: un círculo con
            "SI" no dice nada, y el dato ya figura arriba ("Sin instructor"). */}
        {instructores && (
          <aside
            aria-label={instructores.length > 1 ? "Instructores" : "Instructor"}
            className="flex flex-col gap-4 lg:col-start-2 lg:row-start-3 lg:mt-6"
          >
            {instructores.map((instructor) => (
              <div key={instructor.id} className="flex items-center gap-3.5">
                <span
                  aria-hidden="true"
                  className="grid size-13 shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px] border-uva-line-strong bg-uva-surface-2 text-uva-cuerpo font-bold text-uva-text"
                >
                  {instructor.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- avatar chico servido desde Storage, mismo criterio que AvatarImage (ui/avatar.tsx)
                    <img
                      src={instructor.fotoUrl}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    iniciales(instructor.nombre)
                  )}
                </span>
                <div className="min-w-0">
                  <p className="m-0 text-uva-detalle text-uva-text-muted">
                    Instructor
                  </p>
                  <p className="m-0 text-uva-cuerpo font-bold text-uva-text">
                    {instructor.nombre}
                  </p>
                  {instructor.especialidad && (
                    <p className="m-0 text-uva-detalle text-uva-text-muted">
                      {instructor.especialidad}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </aside>
        )}

        <div className="min-w-0 lg:col-span-2 lg:row-start-4 lg:mt-6">
          <ResenasPublicas
            cursoId={curso.id}
            cursoSlug={curso.slug}
            datos={calificaciones}
          />
        </div>
      </div>
    </div>
  );
}
