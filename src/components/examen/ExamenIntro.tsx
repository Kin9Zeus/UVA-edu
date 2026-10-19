import Link from "next/link";
import type { ReactNode } from "react";
import { ClipboardCheck } from "lucide-react";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { IniciarExamenButton } from "@/components/examen/IniciarExamenButton";
import { CuentaRegresiva } from "@/components/examen/CuentaRegresiva";
import { Uvas } from "@/components/examen/Uvas";
import { Cota } from "@/components/examen/Cota";
import { COOLDOWN_REINTENTO_MINUTOS, VIDAS_INICIALES } from "@/lib/examenes/tipos";
import type { ConteoPreguntas, ResultadoIntentoVista, SituacionExamen } from "@/lib/examen";
import { cn } from "@/lib/utils";

type SituacionVisible = Exclude<SituacionExamen, { situacion: "SIN_EXAMEN" } | { situacion: "EN_CURSO" }>;

/** Cómo se lee cada tipo de pregunta en "Qué evalúa". */
const TIPO_PREGUNTA: Record<string, string> = {
  OPCION_UNICA: "Elegir una respuesta",
  VERDADERO_FALSO: "Verdadero o falso",
  OPCION_MULTIPLE: "Marcar todas las correctas",
  RELLENAR_ESPACIO: "Escribir la respuesta",
  EMPAREJAR: "Relacionar parejas",
};

const BOTON_SECUNDARIO =
  "inline-flex min-h-12 items-center justify-center rounded-uva-md px-5 text-center text-uva-cuerpo font-semibold text-uva-accent-ink underline underline-offset-4 hover:no-underline";

/**
 * Todo lo que el estudiante ve del examen cuando NO está rindiéndolo, con el
 * diseño "examen" del canvas "UVA Cursos":
 *
 * - Pantalla previa (puede iniciar): título, datos del examen, qué evalúa y
 *   la tarjeta "Antes de empezar" con las reglas y "Iniciar examen".
 * - Resultado (aprobado, se quedó sin uvas o en pausa, o se acabó el
 *   tiempo): la tarjeta final del diseño, con el sello "Aprobado".
 *
 * Dice cuántas preguntas quedaron resueltas pero no cuáles faltaron ni cuál
 * era la respuesta correcta: con intentos limitados, revelarlo convertiría el
 * reintento en un trámite (docs/functional-spec.md Flujo 14).
 *
 * Server Component: lo interactivo (iniciar, cuenta regresiva) son islas
 * cliente.
 */
export function ExamenIntro({
  situacion,
  resultado,
  conteo,
  cursoId,
  cursoSlug,
  cursoTitulo,
  tiempoAgotado,
}: {
  situacion: SituacionVisible;
  /** Resultado del último intento cerrado, si hay uno que mostrar. */
  resultado: ResultadoIntentoVista | null;
  /** Cuántas preguntas tiene, por tipo. `null` = no se pudo saber: no se pinta. */
  conteo: ConteoPreguntas | null;
  cursoId: string;
  cursoSlug: string;
  cursoTitulo: string;
  /** El intento se cerró solo porque se acabó el tiempo, no porque el
   * estudiante lo enviara. */
  tiempoAgotado: boolean;
}) {
  const muestraResultado =
    situacion.situacion === "APROBADO" ||
    situacion.situacion === "EN_ESPERA" ||
    (tiempoAgotado && resultado !== null);

  return (
    <div className="relative isolate flex-1">
      <div aria-hidden className="uva-reticula pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px]" />
      {muestraResultado ? (
        <Resultado
          situacion={situacion}
          resultado={resultado}
          cursoId={cursoId}
          cursoSlug={cursoSlug}
          cursoTitulo={cursoTitulo}
          tiempoAgotado={tiempoAgotado}
        />
      ) : (
        <Previa
          situacion={situacion as Extract<SituacionVisible, { situacion: "DISPONIBLE" }>}
          resultado={resultado}
          conteo={conteo}
          cursoId={cursoId}
          cursoSlug={cursoSlug}
        />
      )}
    </div>
  );
}

/** Pantalla previa: el estudiante puede iniciar un intento. */
function Previa({
  situacion,
  resultado,
  conteo,
  cursoId,
  cursoSlug,
}: {
  situacion: Extract<SituacionVisible, { situacion: "DISPONIBLE" }>;
  resultado: ResultadoIntentoVista | null;
  conteo: ConteoPreguntas | null;
  cursoId: string;
  cursoSlug: string;
}) {
  const { examen } = situacion;
  const resueltasUltimo = resultado ? resultado.preguntas.filter((p) => p.acertada).length : 0;
  const tipos = conteo
    ? Object.entries(conteo.porTipo)
        .filter(([, total]) => (total ?? 0) > 0)
        .map(([tipo, total]) => ({ tipo, total: total ?? 0, nombre: TIPO_PREGUNTA[tipo] ?? "Otras preguntas" }))
    : [];

  const reglas = [
    "No necesitas terminar las clases para presentarlo.",
    `Tienes ${VIDAS_INICIALES} uvas. Cada respuesta incorrecta te quita una.`,
    "La pregunta que falles vuelve a aparecer más adelante, en una segunda vuelta.",
    `Si te quedas sin uvas, puedes intentarlo de nuevo después de ${COOLDOWN_REINTENTO_MINUTOS} minutos.`,
    ...(examen.minutosLimite !== null
      ? [
          `Tienes ${examen.minutosLimite} minutos. El cronómetro arranca al iniciar y no se detiene aunque cierres la página.`,
        ]
      : []),
    ...(situacion.intentosRestantes !== null
      ? [
          situacion.intentosRestantes === 1
            ? "Te queda 1 intento en esta tanda."
            : `Te quedan ${situacion.intentosRestantes} intentos en esta tanda.`,
        ]
      : []),
  ];

  const datos: { valor: string; etiqueta: string }[] = [
    ...(conteo ? [{ valor: String(conteo.total), etiqueta: conteo.total === 1 ? "pregunta" : "preguntas" }] : []),
    { valor: String(VIDAS_INICIALES), etiqueta: "uvas para fallar" },
    examen.minutosLimite !== null
      ? { valor: `${examen.minutosLimite} min`, etiqueta: "para responder" }
      : { valor: `${COOLDOWN_REINTENTO_MINUTOS} min`, etiqueta: "de pausa si te quedas sin uvas" },
  ];

  return (
    <div className="mx-auto grid w-full max-w-uva grid-cols-1 gap-8 px-4 pt-6 pb-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-start lg:gap-20 lg:px-[clamp(32px,8vw,120px)] lg:pt-12 lg:pb-16">
      <div className="flex min-w-0 flex-col gap-8 lg:gap-10">
        <div className="flex flex-col gap-4">
          <p className="m-0 inline-flex items-center gap-2 text-uva-detalle font-bold text-uva-accent-ink">
            <ClipboardCheck className="size-4.5 shrink-0" strokeWidth={2} aria-hidden />
            Examen final
          </p>
          <h1 className="m-0 text-uva-titulo-2 text-balance text-uva-text lg:text-uva-titulo-3">{examen.titulo}</h1>
          <p className="m-0 max-w-[34em] text-uva-lead text-uva-text-muted">
            Preséntalo cuando te sientas listo, aunque no hayas terminado las clases. Si apruebas, recibes el
            certificado del curso con un código verificable.
          </p>
        </div>

        <dl
          className={cn(
            "m-0 grid rounded-uva-md border border-uva-divider bg-uva-surface",
            datos.length === 3 ? "grid-cols-3" : "grid-cols-2",
          )}
        >
          {datos.map((dato, i) => (
            <div
              key={dato.etiqueta}
              // `flex-col-reverse` pone la cifra arriba (el dt va primero en el
              // HTML); `justify-end` la alinea arriba en todas las columnas
              // aunque las etiquetas ocupen distinto número de líneas.
              className={cn(
                "flex flex-col-reverse justify-end px-3 py-3.5 sm:px-5.5 sm:py-4.5",
                i > 0 && "border-l border-uva-divider",
              )}
            >
              <dt className="mt-0.5 text-uva-detalle text-uva-text-muted">{dato.etiqueta}</dt>
              <dd className="m-0 font-mono text-uva-titulo-4 font-extrabold text-uva-text">{dato.valor}</dd>
            </div>
          ))}
        </dl>

        {(tipos.length > 0 || examen.instrucciones) && (
          <section aria-labelledby="examen-evalua" className="flex flex-col gap-3">
            <h2 id="examen-evalua" className="m-0 text-uva-titulo-4 text-uva-text">
              Qué evalúa
            </h2>
            {examen.instrucciones && (
              <RichTextRenderer contenido={examen.instrucciones} escala="lectura" />
            )}
            {tipos.length > 0 && (
              <ol className="m-0 list-none border-b border-uva-divider p-0">
                {tipos.map((tipo, i) => (
                  <li key={tipo.tipo} className="flex items-center gap-4 border-t border-uva-divider py-3.5">
                    <span
                      aria-hidden
                      className="grid size-10 shrink-0 place-items-center rounded-uva-sm border-[1.5px] border-uva-line-strong font-mono text-uva-cuerpo font-extrabold text-uva-text"
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1 text-uva-cuerpo font-semibold text-uva-text">{tipo.nombre}</span>
                    <span className="shrink-0 font-mono text-uva-detalle text-uva-text-muted">
                      {tipo.total} {tipo.total === 1 ? "pregunta" : "preguntas"}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        )}
      </div>

      <aside
        aria-labelledby="examen-antes"
        className="flex flex-col gap-5.5 rounded-uva-lg border-[1.5px] border-uva-line-strong bg-uva-surface p-5.5 lg:p-8"
      >
        <h2 id="examen-antes" className="m-0 text-uva-titulo-4 text-uva-text">
          Antes de empezar
        </h2>
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {reglas.map((regla) => (
            <li key={regla} className="flex gap-3 text-uva-cuerpo text-uva-text">
              <span
                aria-hidden
                className="mt-[0.55em] size-2 shrink-0 rotate-45 border-[1.5px] border-uva-text bg-uva-accent-2"
              />
              <span>{regla}</span>
            </li>
          ))}
        </ul>
        <dl className="m-0 grid grid-cols-2 border-y border-uva-divider">
          <div className="py-3.5">
            <dt className="text-uva-detalle text-uva-text-muted">Uvas para este intento</dt>
            <dd className="m-0 mt-1.5">
              <Uvas vidas={VIDAS_INICIALES} total={VIDAS_INICIALES} />
            </dd>
          </div>
          <div className="border-l border-uva-divider py-3.5 pl-4.5">
            <dt className="text-uva-detalle text-uva-text-muted">Último intento</dt>
            <dd className="m-0 mt-0.5 font-mono text-uva-cuerpo font-extrabold text-uva-text-muted">
              {resultado ? `${resueltasUltimo}/${resultado.preguntas.length} resueltas` : "Sin intentos"}
            </dd>
          </div>
        </dl>
        <div className="flex flex-col gap-2">
          <IniciarExamenButton
            cursoId={cursoId}
            cursoSlug={cursoSlug}
            etiqueta={situacion.intentosUsados > 0 ? "Iniciar nuevo intento" : "Iniciar examen"}
          />
          <Link href={`/cursos/${cursoSlug}`} className={BOTON_SECUNDARIO}>
            Volver al curso
          </Link>
        </div>
      </aside>
    </div>
  );
}

/** Tarjeta final: aprobado, sin uvas (en pausa) o se acabó el tiempo. */
function Resultado({
  situacion,
  resultado,
  cursoId,
  cursoSlug,
  cursoTitulo,
  tiempoAgotado,
}: {
  situacion: SituacionVisible;
  resultado: ResultadoIntentoVista | null;
  cursoId: string;
  cursoSlug: string;
  cursoTitulo: string;
  tiempoAgotado: boolean;
}) {
  const aprobado = situacion.situacion === "APROBADO";
  const correctas = resultado ? resultado.preguntas.filter((p) => p.acertada).length : 0;
  const total = resultado?.preguntas.length ?? 0;

  let titulo: string;
  let texto: string;
  if (aprobado) {
    titulo = "¡Aprobaste!";
    texto = situacion.certificadoListo
      ? "Respondiste todas las preguntas bien. Tu certificado ya está disponible."
      : "Respondiste todas las preguntas bien. Tu certificado se está preparando.";
  } else if (tiempoAgotado) {
    titulo = "Se acabó el tiempo";
    texto = "Quedaron guardadas las preguntas que alcanzaste a resolver.";
  } else if (situacion.situacion === "EN_ESPERA" && situacion.esperaLarga) {
    titulo = "Sin intentos por ahora";
    texto = `Usaste tus ${situacion.intentosUsados} ${situacion.intentosUsados === 1 ? "intento" : "intentos"} de esta tanda.`;
  } else {
    titulo = "Te quedaste sin uvas";
    texto = "Estuviste cerca. Repasa y vuelve por la revancha.";
  }

  const hora = (iso: string) =>
    new Date(iso).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

  let nota: ReactNode = null;
  if (aprobado) {
    nota = situacion.certificadoListo
      ? "Lo encuentras en Mis certificados, con un código que cualquiera puede verificar."
      : "Te avisamos cuando esté listo en Mis certificados.";
  } else if (situacion.situacion === "EN_ESPERA") {
    nota = (
      <>
        {situacion.esperaLarga
          ? "Tendrás una tanda nueva de intentos"
          : `Entre un intento y otro hay una pausa de ${COOLDOWN_REINTENTO_MINUTOS} minutos. Vuelves`}{" "}
        a las{" "}
        <time dateTime={situacion.disponibleDesde} className="font-mono text-uva-text">
          {hora(situacion.disponibleDesde)}
        </time>
        {/* "9:49 p. m." ya termina en punto: no se repite. */}
        {hora(situacion.disponibleDesde).endsWith(".") ? "" : "."} Aprovecha para repasar las clases.
      </>
    );
  } else {
    nota = `Ya puedes volver a intentarlo. Cada intento empieza con las ${VIDAS_INICIALES} uvas completas.`;
  }

  return (
    <div className="mx-auto w-full max-w-[640px] px-4 pt-8 pb-12 sm:px-6 lg:pt-16">
      <section
        aria-labelledby="examen-fin"
        aria-live="polite"
        className={cn(
          "overflow-hidden rounded-uva-lg border bg-uva-surface",
          aprobado
            ? "border-uva-accent/70 shadow-uva-acento"
            : "border-uva-divider",
        )}
      >
        <div
          className={cn(
            "relative p-5.5 sm:p-8",
            aprobado &&
              "bg-[radial-gradient(120%_140%_at_88%_0%,color-mix(in_srgb,var(--uva-accent)_30%,transparent)_0%,color-mix(in_srgb,var(--uva-accent)_10%,transparent)_35%,transparent_65%)]",
          )}
        >
          {aprobado && (
            <span
              aria-hidden
              className="absolute top-12 right-5 animate-uva-sello rounded-uva-xs border-2 border-uva-accent px-3 py-1 font-mono text-uva-detalle font-extrabold tracking-[0.22em] text-uva-accent-text uppercase outline-[1.5px] outline-offset-[3px] outline-uva-accent outline-solid sm:top-14.5 sm:right-8"
            >
              Aprobado
            </span>
          )}
          <p className={cn("m-0 text-uva-detalle text-uva-text-muted", aprobado && "pr-32")}>
            Examen final de {cursoTitulo}
          </p>
          <h1 id="examen-fin" className={cn("m-0 mt-3.5 text-uva-titulo-2 text-uva-text", aprobado && "pr-28 sm:pr-0")}>
            {titulo}
          </h1>
          <p className="m-0 mt-3 text-uva-cuerpo text-uva-text-muted">{texto}</p>
        </div>

        <dl className="m-0 grid grid-cols-3 border-y border-uva-divider">
          <Dato etiqueta="Resueltas">
            {resultado ? (
              <>
                <span className="text-uva-titulo-4 font-extrabold">{String(correctas).padStart(2, "0")}</span>
                <span className="text-uva-text-muted">/{String(total).padStart(2, "0")}</span>
              </>
            ) : (
              <span className="text-uva-text-muted">Sin datos</span>
            )}
          </Dato>
          <Dato etiqueta="Uvas" borde>
            <Uvas vidas={resultado?.vidasRestantes ?? 0} total={VIDAS_INICIALES} className="size-4 sm:size-4.5" />
          </Dato>
          {aprobado ? (
            <Dato etiqueta="Certificado" borde>
              <span className="text-uva-cuerpo font-extrabold">{situacion.certificadoListo ? "Listo" : "Pendiente"}</span>
            </Dato>
          ) : situacion.situacion === "EN_ESPERA" ? (
            <Dato etiqueta="Próximo intento" borde>
              <span className="text-uva-cuerpo font-extrabold text-uva-accent-text">
                <CuentaRegresiva hasta={situacion.disponibleDesde} />
              </span>
            </Dato>
          ) : (
            <Dato etiqueta="Intentos" borde>
              <span className="text-uva-cuerpo font-extrabold">
                {situacion.situacion === "DISPONIBLE" && situacion.intentosRestantes !== null
                  ? `${situacion.intentosRestantes} más`
                  : "Sin límite"}
              </span>
            </Dato>
          )}
        </dl>

        <div className="px-5.5 py-6 sm:px-8">
          {total > 0 && <Cota correctas={correctas} total={total} />}
          <p className="m-0 mt-4 text-uva-cuerpo text-uva-text-muted">{nota}</p>
        </div>

        <div className="flex flex-col-reverse gap-2.5 border-t border-uva-divider px-5.5 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
          <Link href={`/cursos/${cursoSlug}`} className={BOTON_SECUNDARIO}>
            Volver al curso
          </Link>
          {aprobado ? (
            situacion.certificadoListo && (
              <Link
                href="/dashboard/certificados"
                className="inline-flex min-h-13 items-center justify-center rounded-uva-md bg-uva-btn px-6 text-uva-cuerpo font-semibold text-uva-on-accent hover:bg-uva-btn-hover hover:no-underline"
              >
                Ver mi certificado
              </Link>
            )
          ) : situacion.situacion === "DISPONIBLE" ? (
            <div className="sm:w-64">
              <IniciarExamenButton cursoId={cursoId} cursoSlug={cursoSlug} etiqueta="Iniciar nuevo intento" />
            </div>
          ) : (
            <Link
              href={`/cursos/${cursoSlug}#temario-titulo`}
              className="inline-flex min-h-13 items-center justify-center rounded-uva-md bg-uva-btn px-6 text-uva-cuerpo font-semibold text-uva-on-accent hover:bg-uva-btn-hover hover:no-underline"
            >
              Repasar el curso
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}

function Dato({ etiqueta, borde = false, children }: { etiqueta: string; borde?: boolean; children: ReactNode }) {
  return (
    <div className={cn("min-w-0 px-3 py-4 sm:px-6 sm:py-4.5", borde && "border-l border-uva-divider")}>
      <dt className="text-uva-detalle leading-tight font-bold text-uva-text-muted">{etiqueta}</dt>
      <dd className="m-0 mt-1.5 flex min-h-7 items-center font-mono text-uva-text">{children}</dd>
    </div>
  );
}
