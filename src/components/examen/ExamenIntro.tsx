import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RichTextRenderer } from "@/components/editor/RichTextRenderer";
import { IniciarExamenButton } from "@/components/examen/IniciarExamenButton";
import { CuentaRegresiva } from "@/components/examen/CuentaRegresiva";
import { Uvas } from "@/components/examen/Uvas";
import { Cota } from "@/components/examen/Cota";
import { COOLDOWN_REINTENTO_MINUTOS, VIDAS_INICIALES } from "@/lib/examenes/tipos";
import type { ResultadoIntentoVista, SituacionExamen } from "@/lib/examen";

type SituacionVisible = Exclude<SituacionExamen, { situacion: "SIN_EXAMEN" } | { situacion: "EN_CURSO" }>;

/**
 * Todo lo que el estudiante ve del examen cuando NO está rindiéndolo: la
 * pantalla previa, el resultado del último intento, la espera entre intentos
 * y el estado final aprobado.
 *
 * Es UNA sola pieza, no una pila de tarjetas: un panel con encabezado (el
 * titular cambia según cómo le fue), una franja de métricas, la cota de
 * progreso si ya hubo intento, el mensaje y las acciones al pie. Cada estado
 * rellena las mismas zonas en vez de agregar bloques propios.
 *
 * Dice cuántas preguntas quedaron resueltas pero no cuáles faltaron ni cuál
 * era la respuesta correcta: con intentos limitados, revelarlo convertiría el
 * reintento en un trámite (docs/functional-spec.md Flujo 14).
 *
 * Es un Server Component: lo interactivo (iniciar, cuenta regresiva) son
 * islas cliente.
 */
export function ExamenIntro({
  situacion,
  resultado,
  cursoId,
  cursoSlug,
  cursoTitulo,
  tiempoAgotado,
}: {
  situacion: SituacionVisible;
  /** Resultado del último intento cerrado, si hay uno que mostrar. */
  resultado: ResultadoIntentoVista | null;
  cursoId: string;
  cursoSlug: string;
  cursoTitulo: string;
  /** El intento se cerró solo porque se acabó el tiempo, no porque el
   * estudiante lo enviara. Cambia el titular del resultado. */
  tiempoAgotado: boolean;
}) {
  const { examen } = situacion;
  const aprobado = situacion.situacion === "APROBADO";
  const reprobado = resultado !== null && !aprobado;
  const correctas = resultado ? resultado.preguntas.filter((p) => p.acertada).length : 0;
  const totalPreguntas = resultado?.preguntas.length ?? 0;

  // ---------- Titular ----------
  let titular: string;
  let bajada: string | null;
  if (aprobado) {
    titular = "¡Aprobaste!";
    bajada = situacion.certificadoListo
      ? "Respondiste todas las preguntas bien. Tu certificado ya está disponible."
      : "Respondiste todas las preguntas bien. Termina las clases que te falten para recibir tu certificado.";
  } else if (reprobado) {
    titular = tiempoAgotado ? "Se acabó el tiempo" : "Te quedaste sin uvas";
    bajada = tiempoAgotado
      ? "Quedaron guardadas las preguntas que alcanzaste a resolver."
      : "Estuviste cerca. Repasa y vuelve por la revancha.";
  } else {
    titular = examen.titulo;
    bajada = null;
  }

  // Resplandor de fondo del panel: magenta al aprobar, rojo apagado al
  // perder, un magenta leve antes de empezar.
  const resplandor = aprobado
    ? "bg-[radial-gradient(ellipse_70%_60%_at_85%_0%,rgba(255,0,122,0.22),transparent_70%)]"
    : reprobado
      ? "bg-[radial-gradient(ellipse_70%_60%_at_85%_0%,rgba(239,68,68,0.14),transparent_70%)]"
      : "bg-[radial-gradient(ellipse_70%_60%_at_85%_0%,rgba(255,0,122,0.10),transparent_70%)]";

  return (
    <div className="relative isolate">
      <div aria-hidden className="uva-reticula pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px]" />

      <div className="mx-auto flex w-full max-w-[540px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-12 lg:min-h-[calc(100dvh-65px)] lg:justify-center">
        <Link
          href={`/cursos/${cursoSlug}`}
          className="flex w-fit items-center gap-1.5 text-sm text-uva-muted-2 hover:text-uva-text"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Volver al curso
        </Link>

        <section
          className={`relative overflow-hidden rounded-uva-md border bg-uva-surface/90 shadow-[0_24px_60px_-30px_rgba(0,0,0,0.8)] backdrop-blur ${
            aprobado ? "border-uva-accent/45" : "border-uva-divider"
          }`}
          aria-live={resultado ? "polite" : undefined}
        >
          <div aria-hidden className={`pointer-events-none absolute inset-0 ${resplandor}`} />

          {/* ---------- Encabezado ---------- */}
          <header className="relative flex flex-col gap-2 px-5 pb-6 pt-6 sm:px-8 sm:pb-8 sm:pt-8">
            <p className="truncate text-[10.5px] font-medium uppercase tracking-[0.16em] text-uva-text-faint">
              {resultado ? `${examen.titulo} · ${cursoTitulo}` : `Examen final · ${cursoTitulo}`}
            </p>
            <h1
              className={`font-heading font-extrabold leading-[1.05] tracking-[-0.03em] text-uva-text ${
                resultado ? "text-[32px] sm:text-[38px]" : "text-[26px] sm:text-[30px]"
              } ${aprobado ? "pr-28 sm:pr-40" : ""}`}
            >
              {titular}
            </h1>
            {bajada && <p className="max-w-[46ch] text-[14px] leading-relaxed text-uva-muted">{bajada}</p>}

            {aprobado && (
              <div
                aria-hidden
                className="absolute right-5 top-7 animate-uva-sello rounded-[6px] border-[3px] border-double border-uva-accent px-2.5 py-1 font-mono text-[13px] font-bold tracking-[0.22em] text-uva-accent sm:right-8 sm:top-9 sm:text-[17px]"
              >
                APROBADO
              </div>
            )}
          </header>

          {/* ---------- Métricas ---------- */}
          <dl className="relative grid grid-cols-3 border-y border-uva-divider bg-uva-bg/50">
            {resultado ? (
              <>
                <Metrica etiqueta="Resueltas">
                  <span className="text-[22px] leading-none">{correctas}</span>
                  <span className="text-uva-text-faint">/{totalPreguntas}</span>
                </Metrica>
                <Metrica etiqueta="Uvas">
                  <Uvas vidas={resultado.vidasRestantes} total={VIDAS_INICIALES} className="size-3.5 sm:size-4" />
                </Metrica>
              </>
            ) : (
              <>
                <Metrica etiqueta="Uvas">
                  <Uvas vidas={VIDAS_INICIALES} total={VIDAS_INICIALES} className="size-3.5 sm:size-4" />
                </Metrica>
                <Metrica etiqueta="Tiempo">
                  {examen.minutosLimite === null ? "Libre" : `${examen.minutosLimite} min`}
                </Metrica>
              </>
            )}
            {situacion.situacion === "EN_ESPERA" ? (
              <Metrica etiqueta="Próximo intento" destacada>
                <CuentaRegresiva hasta={situacion.disponibleDesde} />
              </Metrica>
            ) : situacion.situacion === "APROBADO" ? (
              <Metrica etiqueta="Certificado">{situacion.certificadoListo ? "Listo" : "Pendiente"}</Metrica>
            ) : (
              <Metrica etiqueta="Intentos">
                {situacion.intentosRestantes === null ? "Sin límite" : `${situacion.intentosRestantes} más`}
              </Metrica>
            )}
          </dl>

          {resultado && totalPreguntas > 0 && (
            <div className="relative px-5 pt-5 sm:px-8">
              <Cota correctas={correctas} total={totalPreguntas} />
            </div>
          )}

          {/* ---------- Mensaje ---------- */}
          {situacion.situacion !== "APROBADO" && (
            <div className="relative flex flex-col gap-3 px-5 py-5 text-[13.5px] leading-relaxed text-uva-muted sm:px-8 sm:py-6">
              {situacion.situacion === "EN_ESPERA" ? (
                <p>
                  {situacion.esperaLarga ? (
                    <>
                      Usaste tus {situacion.intentosUsados}{" "}
                      {situacion.intentosUsados === 1 ? "intento" : "intentos"} de esta tanda.
                    </>
                  ) : (
                    <>Entre un intento y otro hay una pausa de {COOLDOWN_REINTENTO_MINUTOS} minutos.</>
                  )}{" "}
                  Vuelves a las{" "}
                  <time dateTime={situacion.disponibleDesde} className="font-mono text-uva-text">
                    {new Date(situacion.disponibleDesde).toLocaleTimeString("es-CO", {
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: "America/Bogota",
                    })}
                  </time>
                  {situacion.esperaLarga ? " con una tanda nueva de intentos." : "."} Aprovecha para repasar las
                  clases.
                </p>
              ) : reprobado ? (
                <p>Ya puedes volver a intentarlo. Cada intento empieza con las {VIDAS_INICIALES} uvas completas.</p>
              ) : (
                <>
                  {examen.instrucciones ? (
                    <RichTextRenderer contenido={examen.instrucciones} />
                  ) : (
                    <p>
                      Una pregunta a la vez. Si fallas una, pierdes una uva y esa pregunta vuelve a aparecer
                      más adelante: apruebas cuando las respondes todas bien.
                    </p>
                  )}
                  {examen.minutosLimite !== null && (
                    <p className="flex items-start gap-2 text-[13px]">
                      <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                      El cronómetro arranca al iniciar y no se detiene aunque cierres la página.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

          {/* ---------- Acciones ---------- */}
          <footer
            className={`relative flex flex-col-reverse gap-2.5 border-t border-uva-divider bg-uva-bg/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8 ${
              situacion.situacion === "APROBADO" ? "mt-5" : ""
            }`}
          >
            {situacion.situacion === "APROBADO" ? (
              situacion.certificadoListo ? (
                <Button variant="primary" className="w-full sm:w-fit" render={<Link href="/dashboard/certificados" />}>
                  Ver mi certificado
                </Button>
              ) : (
                <Button variant="primary" className="w-full sm:w-fit" render={<Link href={`/cursos/${cursoSlug}`} />}>
                  Volver al temario
                </Button>
              )
            ) : situacion.situacion === "EN_ESPERA" ? (
              <Button variant="primary" className="w-full sm:w-fit" render={<Link href={`/cursos/${cursoSlug}`} />}>
                Repasar el curso
              </Button>
            ) : (
              <>
                {reprobado && (
                  <Button variant="ghost" className="w-full sm:w-fit" render={<Link href={`/cursos/${cursoSlug}`} />}>
                    Repasar el curso
                  </Button>
                )}
                <IniciarExamenButton
                  cursoId={cursoId}
                  cursoSlug={cursoSlug}
                  etiqueta={situacion.intentosUsados > 0 ? "Iniciar nuevo intento" : "Iniciar examen"}
                />
              </>
            )}
          </footer>
        </section>
      </div>
    </div>
  );
}

function Metrica({
  etiqueta,
  destacada = false,
  children,
}: {
  etiqueta: string;
  destacada?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 border-r border-uva-divider px-3 py-3.5 last:border-r-0 sm:px-6 sm:py-4">
      <dt className="truncate text-[10px] font-medium uppercase tracking-[0.14em] text-uva-text-faint">{etiqueta}</dt>
      <dd
        className={`flex min-h-[22px] items-baseline font-mono text-[14px] font-semibold ${
          destacada ? "text-uva-accent-text" : "text-uva-text"
        }`}
      >
        {children}
      </dd>
    </div>
  );
}
