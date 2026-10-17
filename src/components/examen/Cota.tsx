/**
 * Progreso del examen dibujado como una cota de plano: remates en los
 * extremos y un tramo por pregunta, que se llena en magenta al resolverla
 * (no al "verla": con la cola de reintentos, solo acertar es avanzar).
 */
export function Cota({ correctas, total }: { correctas: number; total: number }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={correctas}
      aria-label="Preguntas resueltas"
      className="flex items-center gap-1"
    >
      <span className="h-3.5 w-[1.5px] shrink-0 bg-uva-line-strong" aria-hidden />
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className={`h-1 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none ${
            i < correctas ? "bg-uva-btn" : "bg-uva-divider"
          }`}
        />
      ))}
      <span className="h-3.5 w-[1.5px] shrink-0 bg-uva-line-strong" aria-hidden />
    </div>
  );
}
