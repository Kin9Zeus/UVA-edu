import Link from "next/link";
import Image from "next/image";
import { Check, ChevronRight, CircleCheck, Lock, Play } from "lucide-react";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { EstrellasCalificacion } from "@/components/curso/EstrellasCalificacion";
import { ResenasCurso } from "@/components/curso/ResenasCurso";
import { ExamenCta } from "@/components/examen/ExamenCta";
import { BarrasNivel, NIVEL, RETICULA } from "@/components/catalogo/CursoTarjetaPublica";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import { formatFecha, formatHoras } from "@/lib/admin/format";
import { esPortadaReal } from "@/lib/media";
import { PRECIOS_HABILITADOS } from "@/lib/features";
import { SIN_INSTRUCTOR } from "@/lib/instructores";
import { cn } from "@/lib/utils";
import type { CursoPublico, LeccionPublica } from "@/lib/curso";
import type { CalificacionesCurso } from "@/lib/curso-calificaciones";
import type { SituacionExamen } from "@/lib/examen";

/** "4,7": coma decimal y siempre un decimal, como se lee en español. */
const formatPromedio = new Intl.NumberFormat("es-CO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
}).format;

const BOTON_PRIMARIO =
  "flex w-full flex-col items-center justify-center gap-0.5 rounded-uva-md bg-uva-btn px-4.5 py-2.5 text-center text-uva-cuerpo leading-tight font-semibold text-uva-on-accent hover:bg-uva-btn-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";
const BOTON_SECUNDARIO =
  "flex min-h-13 w-full lg:min-h-12 items-center justify-center rounded-uva-md border-[1.5px] border-uva-line-strong px-5 text-center text-uva-cuerpo font-semibold text-uva-text hover:border-uva-text hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

/** Duración de una clase como se lee en un reproductor: `3:20`, `1:02:05`. `null` si no hay video listo. */
function duracionClase(segundos: number | null): string | null {
  if (segundos === null || segundos <= 0) return null;
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.floor((segundos % 3600) / 60);
  const resto = String(segundos % 60).padStart(2, "0");
  return horas > 0 ? `${horas}:${String(minutos).padStart(2, "0")}:${resto}` : `${minutos}:${resto}`;
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

/** Lo que solo existe con la sesión iniciada. */
export type SesionFicha = {
  usuarioId: string;
  esAdmin: boolean;
  situacionExamen: SituacionExamen;
};

type EstadoClase = "continuar" | "vista" | "abierta" | "vista-previa" | "bloqueada";

/**
 * Una clase del temario. Con acceso todas se abren: la vista lleva check y
 * "Vista", y la que sigue va resaltada con "Continúa aquí". Sin acceso solo
 * se abre la vista previa gratis; las demás llevan candado (el check de lo ya
 * visto se conserva: el progreso no se pierde al vencerse el acceso).
 */
function FilaClase({
  leccion,
  numero,
  cursoSlug,
  estado,
}: {
  leccion: LeccionPublica;
  numero: number;
  cursoSlug: string;
  estado: EstadoClase;
}) {
  const duracion = duracionClase(leccion.duracion);
  const resaltada = estado === "continuar" || estado === "vista-previa";
  const bloqueada = estado === "bloqueada";
  const etiqueta =
    estado === "continuar"
      ? "Continúa aquí"
      : estado === "vista-previa"
        ? "Vista previa gratis"
        : leccion.completado
          ? "Vista"
          : null;

  const contenido = (
    <>
      {/* Columna del número: el círculo tapa la línea vertical del módulo. */}
      <span className="grid w-7.5 shrink-0 place-items-center md:w-11">
        <span
          className={cn(
            "grid size-7 place-items-center rounded-full font-mono text-xs font-extrabold",
            resaltada
              ? "bg-uva-btn text-uva-on-accent"
              : leccion.completado
                ? "bg-uva-accent-2 text-uva-on-bright"
                : "border-2 border-uva-line-strong bg-uva-bg text-uva-text",
          )}
        >
          {leccion.completado && !resaltada ? <Check className="size-4" strokeWidth={3} aria-hidden /> : numero}
        </span>
      </span>

      {/* La miniatura solo desde 640 px: en celular le quitaba casi la mitad
          del ancho al título y a 64 px no aporta nada. */}
      <span
        className={cn(
          "relative hidden h-9 w-16 shrink-0 overflow-hidden rounded-uva-xs bg-uva-surface-2 sm:block md:h-13.5 md:w-24",
          resaltada ? "outline-2 outline-offset-1 outline-uva-btn" : "border border-uva-divider",
        )}
      >
        {leccion.miniaturaUrl && (
          <MiniaturaMux
            src={leccion.miniaturaUrl}
            loading="lazy"
            className={cn("absolute inset-0 size-full object-cover", bloqueada && "opacity-50")}
          />
        )}
        {resaltada && (
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid size-6 place-items-center rounded-full bg-uva-btn text-uva-on-accent">
              <Play className="size-3 fill-current" strokeWidth={0} aria-hidden />
            </span>
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-uva-cuerpo leading-snug",
            resaltada ? "font-bold text-uva-text" : bloqueada ? "font-medium text-uva-text-muted" : "font-semibold text-uva-text",
          )}
        >
          {leccion.titulo}
        </span>
        {/* Segunda línea: el estado en texto (la bloqueada lleva candado y la
            palabra, no solo el ícono) y, en celular, la duración. */}
        {(etiqueta || bloqueada || duracion) && (
          <span className="flex flex-wrap items-center gap-x-2.5 text-uva-detalle">
            {bloqueada && (
              <span className="inline-flex items-center gap-1 font-bold text-uva-text-muted">
                <Lock className="size-3.5" strokeWidth={2.4} aria-hidden />
                Bloqueada
              </span>
            )}
            {etiqueta && (
              <span
                className={cn(
                  "font-bold",
                  estado === "vista-previa"
                    ? "rounded-full border-[1.5px] border-uva-accent-ink px-2 text-uva-accent-ink"
                    : resaltada
                      ? "text-uva-accent-ink"
                      : "text-uva-accent-2-text",
                )}
              >
                {etiqueta}
              </span>
            )}
            {duracion && (
              <span className="font-mono text-uva-text-muted sm:hidden">
                <span className="sr-only">Duración </span>
                {duracion}
              </span>
            )}
          </span>
        )}
      </span>

      {duracion && (
        <span className="hidden shrink-0 font-mono text-uva-detalle text-uva-text-muted sm:block">
          <span className="sr-only">Duración </span>
          {duracion}
        </span>
      )}
    </>
  );

  const clases = "flex min-h-15 items-center gap-2.5 rounded-uva-sm py-1 md:min-h-17.5 md:gap-4";

  return (
    <li className="relative">
      {bloqueada ? (
        <div className={clases}>{contenido}</div>
      ) : (
        <Link
          href={`/cursos/${cursoSlug}/${leccion.slug}`}
          className={cn(
            clases,
            // Sin fondo ni barra lateral en la clase resaltada: la marcan el
            // número en magenta, el borde de la miniatura y "Continúa aquí".
            "pr-2 hover:bg-uva-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent",
          )}
        >
          {contenido}
        </Link>
      )}
    </li>
  );
}

/**
 * Ficha de un curso (`/cursos/[slug]`), dirección visual «Maqueta» (artboard
 * "Curso" del canvas "UVA Cursos"). Una sola ficha para los dos casos, para
 * que no se separen con el tiempo.
 *
 * Con sesión (`sesion`): "Seguir viendo" / "Comenzar curso" / "Repasar
 * curso", "Mis notas del curso", el temario con el avance (check y "Vista",
 * "Continúa aquí", "3/3" por módulo), la tarjeta del examen final y las
 * reseñas en las que se puede escribir. Sin acceso al curso, canjear o
 * renovar.
 *
 * Sin sesión: solo la primera clase se puede ver (vista previa pública, igual
 * que `lib/leccion.ts`), y solo si el curso tiene más de una clase; sin
 * avance, sin examen (no es contenido público) y reseñas de solo lectura.
 *
 * Orden del HTML = orden en celular (título, portada y botones, descripción,
 * temario, instructor y examen, reseñas). En escritorio la cuadrícula sube la
 * portada a la columna derecha, así el teclado y el lector de pantalla siguen
 * el mismo recorrido en los dos tamaños.
 */
export function CursoFicha({
  curso,
  calificaciones,
  sesion,
}: {
  curso: CursoPublico;
  calificaciones: CalificacionesCurso;
  sesion: SesionFicha | null;
}) {
  const modulos = curso.modulos.filter((modulo) => modulo.lecciones.length > 0);
  const lecciones = modulos.flatMap((modulo) => modulo.lecciones);
  const primeraLeccion = lecciones[0];
  const vistaPrevia = curso.totalClases > 1 ? primeraLeccion : undefined;
  const conAcceso = sesion !== null && curso.tieneAcceso;
  const basePath = sesion ? "/dashboard/catalogo" : "/catalogo";

  // Con acceso: retomar donde quedó, empezar o repasar.
  const siguiendo = curso.progresoIniciado && curso.leccionContinuarId !== null;
  const completado = curso.progresoIniciado && curso.leccionContinuarId === null;
  const destino = siguiendo
    ? {
        slug: curso.leccionContinuarSlug!,
        numero: curso.leccionContinuarNumero,
        titulo: curso.leccionContinuarTitulo,
      }
    : primeraLeccion
      ? { slug: primeraLeccion.slug, numero: 1, titulo: primeraLeccion.titulo }
      : null;
  const rutaDestino = destino ? `/cursos/${curso.slug}/${destino.slug}` : null;
  const rutaVistaPrevia = vistaPrevia ? `/cursos/${curso.slug}/${vistaPrevia.slug}` : null;
  // Adónde lleva la portada: el mismo destino que el botón principal.
  const rutaPortada = conAcceso ? rutaDestino : rutaVistaPrevia;

  const categoria = curso.categorias[0];
  const nivel = NIVEL[curso.nivel];
  const instructores = curso.instructores.length > 0 ? curso.instructores : null;
  const duracionTotal = curso.duracionTotalSegundos > 0 ? formatHoras(curso.duracionTotalSegundos) : null;
  const conPortada = esPortadaReal(curso.imagenPortada);
  const notaAcceso = PRECIOS_HABILITADOS
    ? "Las demás clases se abren con tu suscripción."
    : "Las demás clases se abren con tu código de invitación.";

  // Numeración corrida en todo el curso (1…N), como el reproductor.
  const numeroDeClase = new Map(lecciones.map((leccion, indice) => [leccion.id, indice + 1]));

  // Módulos plegables: queda abierto el que tiene la clase por la que sigue
  // quien ya empezó; para el resto, el primero.
  const moduloAbiertoId =
    (conAcceso && curso.leccionContinuarId
      ? modulos.find((modulo) => modulo.lecciones.some((leccion) => leccion.id === curso.leccionContinuarId))?.id
      : undefined) ?? modulos[0]?.id;

  const mostrarExamen = sesion !== null && sesion.situacionExamen.situacion !== "SIN_EXAMEN";
  // Sin profesor asignado no hay tarjeta: un círculo con "SI" no dice nada, y
  // el dato ya figura arriba.
  const tarjetaInstructor = instructores && (
    <aside
      aria-label={instructores.length > 1 ? "Instructores" : "Instructor"}
      className="order-4 flex flex-col gap-4 @max-2xl:border-y @max-2xl:border-uva-divider @max-2xl:py-4 @2xl:order-5 @4xl:order-none"
    >
      {instructores.map((instructor) => (
        <div key={instructor.id} className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="grid size-13 shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px] border-uva-line-strong bg-uva-surface-2 text-uva-cuerpo font-bold text-uva-text"
          >
            {instructor.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- avatar chico servido desde Storage, mismo criterio que AvatarImage (ui/avatar.tsx)
              <img src={instructor.fotoUrl} alt="" loading="lazy" className="size-full object-cover" />
            ) : (
              iniciales(instructor.nombre)
            )}
          </span>
          <div className="min-w-0">
            <p className="m-0 text-uva-detalle text-uva-text-muted">Instructor</p>
            <p className="m-0 text-uva-cuerpo font-bold text-uva-text">{instructor.nombre}</p>
            {instructor.especialidad && (
              <p className="m-0 text-uva-detalle text-uva-text-muted">{instructor.especialidad}</p>
            )}
          </div>
        </div>
      ))}
    </aside>
  );

  function estadoDe(leccion: LeccionPublica): EstadoClase {
    if (conAcceso) {
      if (leccion.id === curso.leccionContinuarId) return "continuar";
      return leccion.completado ? "vista" : "abierta";
    }
    return leccion.id === vistaPrevia?.id ? "vista-previa" : "bloqueada";
  }

  const portada = (
    <figure
      className="relative aspect-video overflow-hidden rounded-uva-md border border-uva-divider bg-uva-surface-2 @4xl:rounded-uva-lg"
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
            <IconoCategoria clave={categoria.nombre} grosor={5} className="size-16" />
          </span>
        )
      )}
    </figure>
  );

  return (
    // Columnas y orden según el ancho que le queda a la ficha (`@container`;
    // `@2xl` = 672 px hace de tableta y `@4xl` = 896 px de escritorio), no
    // según la pantalla: con el menú del panel al lado, a 1024 px la columna
    // del título quedaba en 190 px.
    <div className="@container mx-auto max-w-uva px-uva-margen pt-4 pb-uva-seccion lg:pt-8">
      <div className="grid grid-cols-1 gap-7 @4xl:grid-cols-[minmax(0,1fr)_440px] @4xl:grid-rows-[auto_1fr_auto] @4xl:gap-x-14 @4xl:gap-y-4">
        {/* Encabezado: ruta, título y datos del curso. */}
        <div className="order-1 flex min-w-0 flex-col gap-3 @4xl:order-none @4xl:col-start-1 @4xl:row-start-1 @4xl:gap-4">
          <nav aria-label="Ruta de navegación">
            <ol className="flex flex-wrap items-center gap-x-2 text-uva-detalle text-uva-text-muted">
              <li>
                <Link
                  href={basePath}
                  className="inline-flex min-h-11 items-center font-bold text-uva-accent-ink hover:underline"
                >
                  Catálogo
                </Link>
              </li>
              {categoria && (
                <li className="flex items-center gap-x-2">
                  <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
                  <Link
                    href={`${basePath}/${categoria.slug}`}
                    className="inline-flex min-h-11 items-center text-uva-text-muted hover:text-uva-text hover:underline"
                  >
                    {categoria.nombre}
                  </Link>
                </li>
              )}
            </ol>
          </nav>

          <h1 className="m-0 text-uva-titulo-2 text-balance text-uva-text @4xl:text-uva-titulo-3">{curso.titulo}</h1>
          {conAcceso && completado && (
            <p className="m-0 inline-flex w-fit items-center gap-1.5 rounded-full bg-uva-accent-2 px-3 py-1 text-uva-detalle font-bold text-uva-on-bright">
              <CircleCheck className="size-4" strokeWidth={2.4} aria-hidden />
              Completaste este curso
            </p>
          )}

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
                        <EstrellasCalificacion puntuacion={calificaciones.promedio} size={15} />
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
              <span>{instructores ? instructores.map((i) => i.nombre).join(", ") : SIN_INSTRUCTOR}</span>
              <span>{plural(curso.totalClases, "clase", "clases")}</span>
              {duracionTotal && <span>{duracionTotal}</span>}
            </p>
          </div>
        </div>

        {/* Columna derecha en escritorio: portada, botones, instructor y examen
            en una sola tarjeta que se queda fija mientras se lee el temario.
            Con la ficha de menos de `@4xl` la envoltura desaparece (`contents`)
            y cada pieza ocupa su lugar con `order`: el instructor va antes del
            temario solo con la ficha angosta (< `@2xl`, celular) y después en
            tableta. */}
        <div className="contents @4xl:sticky @4xl:top-24 @4xl:col-start-2 @4xl:row-span-3 @4xl:row-start-1 @4xl:flex @4xl:flex-col @4xl:gap-6 @4xl:self-start">
        {/* En una sola columna con espacio (tableta, `@2xl` a `@4xl`), portada
            y botones van lado a lado: a todo el ancho, la portada empujaba
            "Seguir viendo" fuera de la primera pantalla. */}
        <div className="order-2 flex min-w-0 flex-col gap-4 @2xl:@max-4xl:grid @2xl:@max-4xl:grid-cols-2 @2xl:@max-4xl:content-start @2xl:@max-4xl:gap-x-6 @4xl:order-none @4xl:gap-5">
          {rutaPortada ? (
            // La portada repite el destino del botón de abajo: fuera del orden
            // del teclado y del lector para no anunciar dos veces lo mismo.
            <Link href={rutaPortada} tabIndex={-1} aria-hidden="true" className="block @2xl:@max-4xl:row-span-4">
              {portada}
            </Link>
          ) : (
            <div className="@2xl:@max-4xl:row-span-4">{portada}</div>
          )}

          {conAcceso ? (
            <>
              {rutaDestino && destino ? (
                <Link href={rutaDestino} className={cn(BOTON_PRIMARIO, "min-h-16 @4xl:min-h-14")}>
                  {siguiendo ? "Seguir viendo" : completado ? "Repasar curso" : "Comenzar curso"}
                  {destino.titulo && !completado && (
                    <small className="block w-full min-w-0 truncate text-uva-detalle font-medium">
                      Clase {destino.numero}, {destino.titulo}
                    </small>
                  )}
                </Link>
              ) : (
                <p className="m-0 rounded-uva-md border border-uva-divider bg-uva-surface p-4 text-center text-uva-cuerpo text-uva-text-muted">
                  El curso todavía no tiene clases.
                </p>
              )}
              <Link href={`/dashboard/notas?curso=${curso.slug}`} className={cn(BOTON_SECUNDARIO, "-mt-2")}>
                Mis notas del curso
              </Link>
            </>
          ) : (
            <>
              {rutaVistaPrevia && vistaPrevia && (
                <Link href={rutaVistaPrevia} className={cn(BOTON_PRIMARIO, "min-h-16 @4xl:min-h-14")}>
                  Ver la primera clase gratis
                  <small className="block w-full min-w-0 truncate text-uva-detalle font-medium">
                    Clase 1, {vistaPrevia.titulo}
                  </small>
                </Link>
              )}
              <AccesoSinCurso curso={curso} conSesion={sesion !== null} conVistaPrevia={rutaVistaPrevia !== null} />
              <p className="m-0 -mt-1 text-center text-uva-detalle text-uva-text-muted">
                {curso.accesoVencido && curso.progresoIniciado ? "Tu progreso queda guardado." : notaAcceso}
              </p>
            </>
          )}
        </div>
        {tarjetaInstructor}
        {/* El examen va dos veces y se muestra una: dentro de la tarjeta fija
            en escritorio, y después del temario en celular y tableta. Así el
            orden del teclado sigue al orden que se ve. */}
        {mostrarExamen && sesion && (
          <div className="hidden @4xl:block">
            <ExamenCta situacion={sesion.situacionExamen} cursoSlug={curso.slug} />
          </div>
        )}
        </div>

        {/* Descripción. */}
        <div className="order-3 flex min-w-0 flex-col gap-3 @4xl:order-none @4xl:col-start-1 @4xl:row-start-2">
          <p className="m-0 max-w-prose text-uva-cuerpo text-uva-text">{curso.descripcion}</p>
          <p className="m-0 font-mono text-uva-detalle text-uva-text-muted">
            Actualizado el {formatFecha(curso.fechaEdicion)}
          </p>
        </div>

        {/* Temario. */}
        <section
          aria-labelledby="temario-titulo"
          className="order-5 flex min-w-0 flex-col gap-3 @2xl:order-4 @4xl:order-none @4xl:col-start-1 @4xl:row-start-3 @4xl:mt-6"
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="temario-titulo" className="m-0 text-uva-titulo-4 text-uva-text">
                Temario
              </h2>
              <p className="m-0 flex flex-wrap gap-x-3 font-mono text-uva-detalle text-uva-text-muted">
                <span>{plural(modulos.length, "módulo", "módulos")}</span>
                <span>{plural(curso.totalClases, "clase", "clases")}</span>
                {duracionTotal && <span>{duracionTotal}</span>}
              </p>
            </div>
            {curso.totalClases > 0 && !conAcceso && (
              <p className="m-0 text-uva-detalle text-uva-text-muted">
                {vistaPrevia
                  ? sesion
                    ? `La primera clase es gratis. ${notaAcceso}`
                    : "La primera clase es gratis y no necesita cuenta."
                  : sesion
                    ? notaAcceso
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
              {modulos.map((modulo, indiceModulo) => {
                // Avance del módulo: solo las clases con video, como el certificado.
                const conVideo = modulo.lecciones.filter((leccion) => leccion.videoListo);
                const vistas = conVideo.filter((leccion) => leccion.completado).length;
                const mostrarAvance = conAcceso && conVideo.length > 0;
                return (
                  <li key={modulo.id} className="border-t border-uva-divider pt-1.5 pb-2.5">
                    {/* <details> nativo: se pliega con teclado y lector de
                        pantalla sin JavaScript de cliente. */}
                    <details open={modulo.id === moduloAbiertoId} className="group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3.5 rounded-uva-sm hover:bg-uva-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent [&::-webkit-details-marker]:hidden">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-10 shrink-0 place-items-center rounded-uva-md border-[1.5px] font-mono text-uva-cuerpo font-extrabold md:size-11",
                          mostrarAvance && vistas === conVideo.length
                            ? "border-uva-text bg-uva-accent-2 text-uva-on-bright"
                            : "border-uva-text bg-uva-surface-2 text-uva-text",
                        )}
                      >
                        {String(indiceModulo + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block text-uva-detalle text-uva-text-muted">
                          Módulo {indiceModulo + 1} de {modulos.length}
                        </span>
                        <h3 className="m-0 text-uva-cuerpo leading-snug font-bold text-uva-text">{modulo.titulo}</h3>
                      </div>
                      <span className="shrink-0 font-mono text-uva-detalle font-bold text-uva-text-muted">
                        {mostrarAvance ? (
                          <>
                            <span className="sr-only">Vistas: </span>
                            {vistas}/{conVideo.length}
                          </>
                        ) : (
                          plural(modulo.lecciones.length, "clase", "clases")
                        )}
                      </span>
                      <ChevronRight
                        className="size-5 shrink-0 text-uva-text-muted transition-transform group-open:rotate-90 motion-reduce:transition-none"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </summary>

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
                          estado={estadoDe(leccion)}
                        />
                      ))}
                    </ol>
                    </details>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        {mostrarExamen && sesion && (
          <div className="order-6 @4xl:hidden">
            <ExamenCta situacion={sesion.situacionExamen} cursoSlug={curso.slug} />
          </div>
        )}

      </div>

      {/* Fuera de la cuadrícula a propósito: la tarjeta fija de la derecha solo
          debe acompañar al temario, y un `sticky` dentro de una cuadrícula se
          extiende hasta el final de ella. */}
      <div className="mt-7 min-w-0 lg:mt-10">
        <ResenasCurso
          cursoId={curso.id}
          cursoSlug={curso.slug}
          datos={calificaciones}
          sesion={
            sesion
              ? { usuarioActualId: sesion.usuarioId, puedeCalificar: curso.tieneAcceso, esAdmin: sesion.esAdmin }
              : null
          }
        />
      </div>
    </div>
  );
}

/**
 * Sin acceso al curso: sin sesión, entrar; con sesión, canjear un código o
 * renovar (si ya estuvo dentro, se le habla de retomar). Hoy no hay pasarela
 * de pago activa: el acceso es por código de invitación (CLAUDE.md §2).
 */
function AccesoSinCurso({
  curso,
  conSesion,
  conVistaPrevia,
}: {
  curso: CursoPublico;
  conSesion: boolean;
  conVistaPrevia: boolean;
}) {
  const clase = cn(
    conVistaPrevia ? BOTON_SECUNDARIO : cn(BOTON_PRIMARIO, "min-h-13 lg:min-h-12"),
    conVistaPrevia && "-mt-2",
  );
  if (!conSesion) {
    return (
      <Link href={`/login?redirect=/cursos/${curso.slug}`} className={clase}>
        Entra o crea tu cuenta
      </Link>
    );
  }
  const texto = curso.accesoVencido
    ? PRECIOS_HABILITADOS
      ? "Renueva tu acceso"
      : "Canjea un código nuevo"
    : "Canjea tu código";
  return (
    <Link href="/dashboard/suscripcion" className={clase}>
      {texto}
    </Link>
  );
}
