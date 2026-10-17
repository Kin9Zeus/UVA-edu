import Link from "next/link";
import { CheckCircle2, Clock, FileText, Lock } from "lucide-react";
import type { SituacionExamen } from "@/lib/examen";
import { cn } from "@/lib/utils";

/**
 * Tarjeta del examen final en la ficha del curso (artboard "Curso",
 * dirección visual «Maqueta»), en la columna del instructor.
 *
 * Solo aparece si el curso tiene examen publicado y el estudiante tiene
 * acceso: para todos los demás (`SIN_EXAMEN`) no se renderiza nada.
 *
 * Existe porque, sin ella, quien termina la última clase ve el curso al 100 %
 * y no sabe que todavía le falta algo para el certificado: el examen se
 * anuncia desde la ficha, no solo al llegar al final.
 */
export function ExamenCta({
  situacion,
  cursoSlug,
}: {
  situacion: SituacionExamen;
  cursoSlug: string;
}) {
  if (situacion.situacion === "SIN_EXAMEN") return null;

  const href = `/cursos/${cursoSlug}/examen`;
  const { minutosLimite, intentosMaximos } = situacion.examen;

  const { icono, titulo, detalle, etiquetaBoton } = (() => {
    switch (situacion.situacion) {
      case "APROBADO":
        return {
          icono: <CheckCircle2 className="size-5 text-uva-success-text" aria-hidden />,
          titulo: "Examen aprobado",
          detalle: situacion.certificadoListo
            ? "Completaste el curso. Tu certificado está listo."
            : "Ya aprobaste el examen. Termina las clases que te falten para recibir tu certificado.",
          etiquetaBoton: "Ver resultado",
        };
      case "EN_CURSO":
        return {
          icono: <Clock className="size-5 text-uva-warning-text" aria-hidden />,
          titulo: "Tienes un examen en curso",
          detalle: "Retómalo donde lo dejaste.",
          etiquetaBoton: "Continuar examen",
        };
      case "EN_ESPERA":
        return situacion.esperaLarga
          ? {
              icono: <Lock className="size-5 text-uva-error-text" aria-hidden />,
              titulo: "Sin intentos por ahora",
              detalle: "Agotaste tu tanda de intentos. Tendrás una nueva más tarde.",
              etiquetaBoton: "Ver cuándo",
            }
          : {
              icono: <Clock className="size-5 text-uva-warning-text" aria-hidden />,
              titulo: "Examen pendiente",
              detalle: "Puedes volver a intentarlo en un rato.",
              etiquetaBoton: "Ver cuándo",
            };
      default:
        return {
          icono: <FileText className="size-5 text-uva-accent-ink" aria-hidden />,
          titulo: "Examen final",
          detalle:
            "Preséntalo cuando te sientas listo. Responde bien todas las preguntas sin quedarte sin vidas para completar el curso y recibir tu certificado.",
          etiquetaBoton: situacion.intentosUsados > 0 ? "Reintentar examen" : "Presentar examen",
        };
    }
  })();

  const destacado = situacion.situacion === "DISPONIBLE" || situacion.situacion === "EN_CURSO";
  // Solo datos que el examen trae de verdad: sin límite de tiempo o de
  // intentos, no se pinta la cifra.
  const datos = [
    minutosLimite ? { etiqueta: "Tiempo", valor: `${minutosLimite} min` } : null,
    intentosMaximos ? { etiqueta: "Intentos", valor: String(intentosMaximos) } : null,
  ].filter((dato) => dato !== null);

  return (
    <section
      aria-labelledby="examen-titulo"
      className={cn(
        "flex flex-col gap-3 rounded-uva-lg border p-5",
        destacado ? "border-uva-accent bg-uva-accent-soft" : "border-uva-divider bg-uva-surface",
      )}
    >
      <h2 id="examen-titulo" className="m-0 flex items-center gap-2.5 text-uva-titulo-4 text-uva-text">
        {icono}
        {titulo}
      </h2>
      <p className="m-0 text-uva-detalle text-uva-text-muted">{detalle}</p>
      {datos.length > 0 && situacion.situacion !== "APROBADO" && (
        <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1">
          {datos.map((dato) => (
            <div key={dato.etiqueta} className="flex items-baseline gap-2">
              <dt className="text-uva-detalle text-uva-text-muted">{dato.etiqueta}</dt>
              <dd className="m-0 font-mono text-uva-cuerpo font-bold text-uva-text">{dato.valor}</dd>
            </div>
          ))}
        </dl>
      )}
      <Link
        href={href}
        className={cn(
          "mt-1 inline-flex min-h-12 w-full items-center justify-center rounded-uva-md px-5 text-center text-uva-cuerpo font-semibold hover:no-underline",
          destacado
            ? "bg-uva-btn text-uva-on-accent hover:bg-uva-btn-hover"
            : "border-[1.5px] border-uva-line-strong text-uva-text hover:border-uva-text",
        )}
      >
        {etiquetaBoton}
      </Link>
    </section>
  );
}
