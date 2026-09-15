"use client";

/**
 * Anillo de avance del curso con el porcentaje dentro.
 *
 * Va al lado del título y no bajo el texto: ocupa el alto que ya gastaba el
 * título, así que la pieza entera baja de altura en vez de sumar un renglón.
 *
 * `-rotate-90` arranca el arco arriba (a las 12) en vez de a las 3, que es
 * donde SVG empieza a dibujar un círculo. `strokeDasharray` con la
 * circunferencia completa y `strokeDashoffset` con lo que falta es el truco
 * de siempre: el trazo se "consume" en proporción al avance.
 */
export function AnilloProgreso({ porcentaje, etiqueta }: { porcentaje: number; etiqueta: string }) {
  const RADIO = 14;
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
  const acotado = Math.min(100, Math.max(0, porcentaje));

  return (
    <span
      className="relative grid size-9 shrink-0 place-items-center"
      role="progressbar"
      aria-valuenow={acotado}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
    >
      <svg viewBox="0 0 32 32" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="16" cy="16" r={RADIO} fill="none" strokeWidth="2.5" className="stroke-uva-text/12" />
        <circle
          cx="16"
          cy="16"
          r={RADIO}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="stroke-uva-accent transition-[stroke-dashoffset]"
          strokeDasharray={CIRCUNFERENCIA}
          strokeDashoffset={CIRCUNFERENCIA * (1 - acotado / 100)}
        />
      </svg>
      {/* Con el "%" dentro: el anillo solo dice "algo de algo", el signo lo
          vuelve una cifra. A 9px "100%" cabe en el hueco de 28px que deja el
          trazo. */}
      <span className="relative font-mono text-[9px] tabular-nums text-uva-text">{acotado}%</span>
    </span>
  );
}
