import { Progress } from "@/components/ui/progress";
import Link from "next/link";
import Image from "next/image";
import { Award, Check, Compass, Flame, Play } from "lucide-react";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { Button } from "@/components/ui/button";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { IconoCategoria } from "@/components/categorias/IconoCategoria";
import { FiltroCursos } from "@/components/dashboard/FiltroCursos";
import { esPortadaReal } from "@/lib/media";
import { cn } from "@/lib/utils";
import type { CursoConProgreso, ProgresoData } from "@/lib/progreso";

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

/** Botones de las filas y estados: 45 px en táctil, compactos con mouse. */
const BOTON =
  "min-h-11.25 gap-2 px-4 text-uva-cuerpo md:pointer-fine:h-9 md:pointer-fine:min-h-9 md:pointer-fine:text-uva-detalle";

function hrefCurso(curso: CursoConProgreso) {
  return `/cursos/${curso.cursoSlug}`;
}

/** Clase a retomar; sin ella (temario sin leer), la ficha del curso. */
function hrefSeguir(curso: CursoConProgreso) {
  return curso.siguienteLeccion
    ? `${hrefCurso(curso)}/${curso.siguienteLeccion.slug}`
    : hrefCurso(curso);
}

/** Frame donde quedó, si no la portada, si no la retícula con el ícono. */
function Miniatura({
  curso,
  sizes,
  className,
}: {
  curso: CursoConProgreso;
  sizes: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "relative block aspect-video w-full overflow-hidden rounded-uva-md border border-uva-divider",
        className,
      )}
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
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <span className={`absolute inset-0 grid place-items-center ${RETICULA}`}>
          {curso.categoria && (
            <IconoCategoria clave={curso.categoria} className="size-10 md:size-14" />
          )}
        </span>
      )}
    </span>
  );
}

function Cifra({ valor, etiqueta }: { valor: string; etiqueta: string }) {
  return (
    <div className="flex flex-col-reverse px-[18px] py-4">
      <dt className="mt-0.5 text-uva-detalle text-uva-text-muted">{etiqueta}</dt>
      <dd className="font-mono text-uva-titulo-3 text-uva-text">{valor}</dd>
    </div>
  );
}

function Cifras({ cursos }: { cursos: CursoConProgreso[] }) {
  const terminados = cursos.filter((curso) => curso.completado).length;
  const clasesVistas = cursos.reduce((total, curso) => total + curso.leccionesCompletadas, 0);
  const segundosVistos = cursos.reduce((total, curso) => total + curso.segundosVistos, 0);

  return (
    <dl
      className="grid grid-cols-2 border-t border-uva-divider [&>div]:border-uva-divider [&>div:nth-child(even)]:border-l lg:grid-cols-4 lg:[&>div:not(:first-child)]:border-l max-lg:[&>div:nth-child(n+3)]:border-t"
    >
      <Cifra
        valor={String(cursos.length)}
        etiqueta={cursos.length === 1 ? "curso inscrito" : "cursos inscritos"}
      />
      <Cifra valor={String(terminados)} etiqueta={terminados === 1 ? "terminado" : "terminados"} />
      <Cifra
        valor={String(clasesVistas)}
        etiqueta={clasesVistas === 1 ? "clase vista" : "clases vistas"}
      />
      <Cifra valor={duracionTexto(segundosVistos)} etiqueta="de clases vistas" />
    </dl>
  );
}

function Actividad({ actividad }: { actividad: NonNullable<ProgresoData["actividad"]> }) {
  const { racha, semanas } = actividad;
  const actual = semanas[semanas.length - 1];
  const promedio = semanas.reduce((total, semana) => total + semana.dias, 0) / semanas.length;
  const promedioTexto = Number.isInteger(promedio)
    ? String(promedio)
    : promedio.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  const etiqueta = (semana: (typeof semanas)[number]) =>
    semana.esActual ? "Esta semana" : fechaCorta(semana.inicio);

  return (
    <section
      aria-labelledby="progreso-actividad"
      className="flex flex-col gap-5 border-t border-uva-divider pt-5 lg:flex-row lg:items-center lg:gap-12"
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
          {racha === 0 ? "Sin racha por ahora" : `Racha de ${racha} ${racha === 1 ? "día" : "días"}`}
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
          En el último mes, tu promedio es de {promedioTexto} {promedio === 1 ? "día" : "días"} por
          semana.
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
            <div key={semana.inicio} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <span
                className={`font-mono text-uva-detalle ${semana.esActual ? "font-extrabold text-uva-text" : "font-semibold text-uva-text-muted"}`}
              >
                {semana.dias} <span className="font-normal text-uva-text-muted">de 7</span>
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
          Último mes. Cada barra es una semana: la parte llena son los días en que viste al menos
          una clase.
        </p>
      </div>
    </section>
  );
}

/** El curso salió del catálogo pero quien ya lo veía puede terminarlo (supabase/sql/030). */
function AvisoFueraDeCatalogo() {
  return (
    <p className="text-uva-detalle text-uva-text-muted">
      Ya no está en el catálogo; puedes terminarlo.
    </p>
  );
}

function FilaCurso({ curso, hoy }: { curso: CursoConProgreso; hoy: string }) {
  const examenPendiente = !curso.completado && curso.porcentaje === 100 && curso.examenRequerido;
  const destino = curso.completado
    ? curso.certificadoEmitido
      ? "/dashboard/certificados"
      : hrefCurso(curso)
    : examenPendiente
      ? `${hrefCurso(curso)}/examen`
      : hrefSeguir(curso);
  const accion = curso.completado
    ? curso.certificadoEmitido
      ? "Ver certificado"
      : "Ver curso"
    : examenPendiente
      ? "Presentar examen"
      : "Continuar";
  const Icono = curso.completado ? Award : Play;

  return (
    // Por debajo de 400 px la miniatura se va: con ella el título quedaba en
    // 4 líneas de dos palabras.
    <li className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-3.5 border-t border-uva-divider py-3.5 max-[399px]:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[200px_minmax(0,1fr)_auto] md:gap-5">
      <Link href={destino} tabIndex={-1} aria-hidden="true" className="block max-[399px]:hidden">
        <Miniatura curso={curso} sizes="(max-width: 767px) 96px, 200px" className="rounded-uva-sm" />
      </Link>

      <div className="grid min-w-0 gap-1.5">
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-uva-detalle text-uva-text-muted">
          {curso.completado ? (
            <span className="inline-flex min-h-[26px] items-center gap-1.5 rounded-full bg-uva-accent-2 px-2.5 font-bold text-uva-on-bright">
              <Check className="size-3" strokeWidth={3} aria-hidden="true" />
              Completado
            </span>
          ) : (
            <span className="inline-flex min-h-[26px] items-center rounded-full bg-uva-accent-soft px-2.5 font-bold text-uva-accent-ink">
              En progreso
            </span>
          )}
          {curso.categoria && (
            <span className="inline-flex items-center gap-1.5">
              <IconoCategoria clave={curso.categoria} className="size-4" />
              {curso.categoria}
            </span>
          )}
        </p>
        <h3 className="text-uva-cuerpo leading-snug font-extrabold text-uva-text">{curso.titulo}</h3>
        {curso.completado ? (
          curso.certificadoEmitido && (
            <p className="font-mono text-uva-detalle text-uva-text-muted">
              Terminado el {fechaLarga(curso.certificadoEmitido)}
            </p>
          )
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Progress
                value={curso.porcentaje}
                aria-label={`${curso.leccionesCompletadas} de ${curso.leccionesTotal} clases vistas`}
                className="flex-1"
              />
              <span className="font-mono text-uva-detalle font-bold whitespace-nowrap text-uva-text">
                {curso.leccionesCompletadas}/{curso.leccionesTotal}
              </span>
            </div>
            {examenPendiente ? (
              <p>
                <span className="inline-flex min-h-[26px] items-center rounded-full bg-uva-badge-warn-bg px-2.5 text-uva-detalle font-bold text-uva-badge-warn-fg">
                  Examen pendiente
                </span>
              </p>
            ) : (
              <p className="text-uva-detalle text-uva-text-muted">
                {curso.siguienteLeccion && (
                  <span className="max-md:hidden">
                    Sigue: clase {curso.siguienteLeccion.numero}, {curso.siguienteLeccion.titulo}.{" "}
                  </span>
                )}
                {curso.ultimaActividad && `Última vez ${haceCuanto(curso.ultimaActividad, hoy)}.`}
              </p>
            )}
          </>
        )}
        {!curso.publicado && <AvisoFueraDeCatalogo />}
      </div>

      {/* En celular solo el ícono (44×44) para dejarle el ancho al título; el
          nombre accesible dice la acción y el curso. */}
      <Button
        render={<Link href={destino} aria-label={`${accion}: ${curso.titulo}`} />}
        nativeButton={false}
        variant={curso.completado ? "uva-secondary" : "uva-primary"}
        size="uva"
        className={cn(BOTON, "max-md:size-11 max-md:min-h-11 max-md:p-0")}
      >
        <Icono
          className={cn("size-[18px]", !curso.completado && "size-4 fill-current")}
          aria-hidden="true"
        />
        <span className="max-md:sr-only">{accion}</span>
      </Button>
    </li>
  );
}

function TerminasteTodo({ conCertificado }: { conCertificado: boolean }) {
  return (
    <section className="flex flex-col items-start gap-3.5 rounded-uva-lg border border-uva-divider bg-uva-surface p-6 md:p-7">
      <h2 className="text-uva-titulo-4 text-uva-text">Terminaste todos tus cursos</h2>
      <p className="max-w-[52ch] text-uva-cuerpo text-uva-text-muted">
        {conCertificado
          ? "Tus certificados están listos para descargar y compartir. Cuando quieras, empieza otro curso del catálogo."
          : "Cuando quieras, empieza otro curso del catálogo."}
      </p>
      <div className="flex w-full flex-wrap gap-2.5">
        {conCertificado && (
          <Button
            render={<Link href="/dashboard/certificados" />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className={cn(BOTON, "max-sm:w-full")}
          >
            <Award className="size-[18px]" aria-hidden="true" />
            Ver mis certificados
          </Button>
        )}
        <Button
          render={<Link href="/dashboard/catalogo" />}
          nativeButton={false}
          variant={conCertificado ? "uva-secondary" : "uva-primary"}
          size="uva"
          className={cn(BOTON, "max-sm:w-full")}
        >
          <Compass className="size-[18px]" aria-hidden="true" />
          Explorar el catálogo
        </Button>
      </div>
    </section>
  );
}

/**
 * Mis cursos, como el lienzo "Direcciones visuales" (Dash-Progreso): cifras,
 * ritmo de estudio a todo el ancho y una sola lista con filtro. La primera
 * fila es el curso más reciente, con su botón para continuar.
 */
export function ProgresoContent({ data, hoy }: { data: ProgresoData; hoy: string }) {
  const { cursos, actividad } = data;

  // `cursos` ya llega ordenado por actividad reciente (vista
  // progreso_cursos_estudiante). `completado` y no `porcentaje === 100`: con
  // el examen sin aprobar el curso sigue en curso (ver lib/progreso.ts).
  const enCurso = cursos.filter((curso) => !curso.completado);
  const terminados = cursos.filter((curso) => curso.completado);
  const resumen =
    cursos.length === 0
      ? "Aquí verás los cursos que empieces y retomarás cada uno donde lo dejaste."
      : `${enCurso.length === 0 ? "Ninguno" : enCurso.length} en curso y ${terminados.length} ${terminados.length === 1 ? "terminado" : "terminados"}`;

  return (
    // Sin el margen global de p y títulos (globals.css): los espacios los da el gap.
    <div className="mx-auto flex w-full max-w-uva flex-col gap-9 px-uva-margen py-7 lg:py-9 [&_h1]:mb-0 [&_h2]:mb-0 [&_h3]:mb-0 [&_p]:mb-0">
      <div>
        <h1 className="text-uva-titulo-3 text-uva-text">Mis cursos</h1>
        <p className="mt-2 text-uva-lead text-uva-text-muted">{resumen}</p>
      </div>

      {cursos.length === 0 ? (
        <EstadoVacio
          titulo="Todavía no empiezas ningún curso"
          texto="Elige uno del catálogo y dale play a la primera clase. Tu avance aparece aquí y retomas donde quedaste."
          accion={{ etiqueta: "Explorar el catálogo", href: "/dashboard/catalogo" }}
        />
      ) : (
        <>
          <Cifras cursos={cursos} />
          {actividad ? (
            <Actividad actividad={actividad} />
          ) : (
            <p className="border-t border-uva-divider pt-5 text-uva-detalle text-uva-text-muted">
              No pudimos cargar tu actividad de estudio. Recarga la página para intentarlo de nuevo.
            </p>
          )}
          {enCurso.length === 0 && (
            <TerminasteTodo conCertificado={terminados.some((curso) => curso.certificadoEmitido)} />
          )}
          <section aria-labelledby="progreso-cursos" className="flex flex-col gap-3.5">
            <h2 id="progreso-cursos" className="text-uva-titulo-4 text-uva-text">
              Tus cursos
            </h2>
            <FiltroCursos
              filas={cursos.map((curso) => ({
                id: curso.cursoId,
                completado: curso.completado,
                fila: <FilaCurso curso={curso} hoy={hoy} />,
              }))}
            />
          </section>
        </>
      )}
    </div>
  );
}
