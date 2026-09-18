/**
 * Progreso del examen dibujado como una cota de plano: una línea de medida
 * con remates en los extremos y una marca por pregunta. Cada tramo se llena
 * en magenta al resolver una pregunta — no al "verla": con la cola de
 * reintentos, solo acertar es avanzar.
 */
export function Cota({ correctas, total }: { correctas: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={correctas}
      aria-label="Preguntas resueltas"
      className="flex items-center"
    >
      <span className="h-3 w-px shrink-0 bg-uva-muted-2" aria-hidden />
      <div className="flex flex-1 items-center gap-[3px] px-[3px]" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${
              i < correctas ? "bg-uva-accent shadow-[0_0_8px_rgba(255,0,122,0.55)]" : "bg-uva-divider"
            }`}
          />
        ))}
      </div>
      <span className="h-3 w-px shrink-0 bg-uva-muted-2" aria-hidden />
    </div>
  );
}
