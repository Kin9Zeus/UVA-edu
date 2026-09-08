import Link from "next/link";
import { CheckCircle2, Clock, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SituacionExamen } from "@/lib/examen";

/**
 * Tarjeta del examen final en la ficha del curso, debajo del CTA principal.
 *
 * Solo aparece si el curso tiene examen publicado y el estudiante tiene
 * acceso: para todos los demás (`SIN_EXAMEN`) no se renderiza nada, y la
 * ficha queda exactamente como estaba antes de esta funcionalidad.
 *
 * Existe porque, sin ella, un estudiante que termina la última clase ve el
 * curso al 100% y no tiene forma de saber que todavía le falta algo para el
 * certificado. El examen tiene que anunciarse desde el temario, no solo
 * cuando ya llegó al final.
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

  const { icono, titulo, detalle, etiquetaBoton } = (() => {
    switch (situacion.situacion) {
      case "APROBADO":
        return {
          icono: <CheckCircle2 className="size-4 text-uva-success" aria-hidden />,
          titulo: "Examen aprobado",
          detalle: "Completaste el curso. Tu certificado está listo.",
          etiquetaBoton: "Ver resultado",
        };
      case "BLOQUEADO":
        return {
          icono: <Lock className="size-4 text-uva-muted" aria-hidden />,
          titulo: "Examen final",
          detalle: `Se habilita al terminar todas las clases. Necesitas ${situacion.examen.notaAprobatoria}% para aprobar.`,
          etiquetaBoton: "Ver requisitos",
        };
      case "EN_CURSO":
        return {
          icono: <Clock className="size-4 text-uva-warn" aria-hidden />,
          titulo: "Tienes un examen en curso",
          detalle: "Retómalo donde lo dejaste.",
          etiquetaBoton: "Continuar examen",
        };
      case "EN_ESPERA":
        return situacion.esperaLarga
          ? {
              icono: <Lock className="size-4 text-uva-error" aria-hidden />,
              titulo: "Sin intentos por ahora",
              detalle: "Agotaste tu tanda de intentos. Tendrás una nueva más tarde.",
              etiquetaBoton: "Ver cuándo",
            }
          : {
              icono: <Clock className="size-4 text-uva-warn" aria-hidden />,
              titulo: "Examen pendiente",
              detalle: "Puedes volver a intentarlo en un rato.",
              etiquetaBoton: "Ver cuándo",
            };
      default:
        return {
          icono: <FileText className="size-4 text-uva-accent" aria-hidden />,
          titulo: "Examen final disponible",
          detalle: `Apruébalo con ${situacion.examen.notaAprobatoria}% o más para completar el curso y recibir tu certificado.`,
          etiquetaBoton: situacion.intentosUsados > 0 ? "Reintentar examen" : "Presentar examen",
        };
    }
  })();

  const destacado = situacion.situacion === "DISPONIBLE" || situacion.situacion === "EN_CURSO";

  return (
    <div
      className={`mt-3 rounded-uva-md border p-3.5 ${
        destacado ? "border-uva-accent bg-uva-accent-soft" : "border-uva-divider bg-uva-surface"
      }`}
    >
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-uva-text">
        {icono}
        {titulo}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-uva-muted">{detalle}</p>
      <Button
        render={<Link href={href} />}
        nativeButton={false}
        variant={destacado ? "uva-primary" : "uva-secondary"}
        size="uva"
        className="mt-3 min-h-10"
      >
        {etiquetaBoton}
      </Button>
    </div>
  );
}
