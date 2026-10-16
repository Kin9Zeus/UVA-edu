import { cn } from "@/lib/utils";

/**
 * Ruta de pasos de recuperar contraseña (Recuperar / Nueva contraseña lab 7,
 * `.ruta`): círculos numerados unidos por una línea. Los anteriores a
 * `actual` van con ✓ amarillo; el actual, con borde de acento;
 * `actual === pasos.length` = todos hechos. El estado de cada paso se dice
 * también en texto para el lector de pantalla, no solo con el color.
 */
export function RutaPasos({
  etiqueta,
  pasos,
  actual,
}: {
  etiqueta: string;
  pasos: string[];
  actual: number;
}) {
  return (
    <ol aria-label={etiqueta} className="grid grid-cols-3 gap-2.5">
      {pasos.map((paso, i) => {
        const hecho = i < actual;
        const esActual = i === actual;
        return (
          <li
            key={paso}
            aria-current={esActual ? "step" : undefined}
            className={cn(
              "relative grid content-start justify-items-start gap-2 text-uva-detalle font-semibold",
              hecho || esActual ? "text-uva-text" : "text-uva-text-muted",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "relative z-[1] grid size-8 place-items-center rounded-full border-2 font-heading text-[15px] font-extrabold bajo:size-7",
                hecho
                  ? "border-uva-text bg-uva-accent-2 text-uva-on-bright"
                  : esActual
                    ? "border-uva-accent bg-uva-surface text-uva-accent-ink"
                    : "border-uva-muted-2 bg-uva-surface text-uva-text-muted",
              )}
            >
              {hecho ? (
                <svg
                  viewBox="0 0 24 24"
                  className="size-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12l5 5 9-10" />
                </svg>
              ) : (
                i + 1
              )}
            </span>
            {i < pasos.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-[15px] left-8 -right-2.5 h-0.5 bajo:top-[13px] bajo:left-7",
                  hecho ? "bg-uva-text" : "bg-uva-muted-2",
                )}
              />
            )}
            <span>
              {paso}
              <span className="sr-only">
                {hecho ? " (hecho)" : esActual ? " (paso actual)" : " (pendiente)"}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
