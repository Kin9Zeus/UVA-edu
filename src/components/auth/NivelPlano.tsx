import { cn } from "@/lib/utils";

/**
 * Nivel de obra en dibujo de plano técnico (Login lab 7, "Nivel plano
 * técnico"): cuerpo con tapas rayadas, dos ojos, ventana con el tubo amarillo,
 * eje al centro y cota debajo. Mientras falta el correo la burbuja está
 * corrida y la marca dice "N +0,12"; desde el paso siguiente queda a nivel.
 *
 * Dibujo de tamaño fijo: sus rótulos ("600 mm", "N +0,12") van en px y no
 * en la escala fluida de letra; donde hay que achicarlo se usa `zoom`.
 *
 * Solo marcado y CSS, oculto para lectores de pantalla: el estado real lo
 * cuentan el título y el subtítulo de cada paso. La transición de la burbuja
 * la apaga la regla global de `prefers-reduced-motion` (globals.css).
 */
export function NivelPlano({ aNivel }: { aNivel: boolean }) {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto h-[78px] w-full max-w-[420px] text-uva-text"
    >
      <span
        className={cn(
          "absolute -top-3.5 -right-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-[0.04em] tabular-nums transition-colors duration-400",
          aNivel ? "text-uva-text" : "text-uva-text-muted",
        )}
      >
        <svg viewBox="0 0 12 10" className="h-[9px] w-[11px]">
          <path
            d="M1 1h10L6 9z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {aNivel ? "N ±0,00" : "N +0,12"}
      </span>

      <span
        className={cn(
          "absolute top-0 left-1/2 h-[58px] transition-colors duration-400",
          aNivel
            ? "border-l-[1.5px] border-solid border-uva-accent-2"
            : "border-l border-dashed border-uva-text-muted",
        )}
      />

      <div className="absolute inset-x-0 top-2.5 z-[1] grid h-[38px] grid-cols-[16px_1fr_auto_1fr_16px] items-center justify-items-center rounded-uva-xs border-[1.5px] border-uva-text bg-uva-surface">
        <span className="self-stretch justify-self-stretch border-r-[1.5px] border-uva-text bg-[repeating-linear-gradient(45deg,var(--uva-text)_0_1px,transparent_1px_5px)]" />
        <Ojo />
        <span className="flex h-5 w-[132px] rounded-uva-xs border-[1.5px] border-uva-text p-[3px]">
          <span className="relative flex-1 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--uva-accent-2)_78%,transparent)]">
            <Raya className="left-[calc(50%-13px)]" />
            <Raya className="left-[calc(50%+9px)]" />
            <span
              className="absolute inset-y-0.5 w-[15px] -translate-x-1/2 rounded-full bg-uva-on-accent ring-1 ring-uva-text transition-[left] duration-500 ease-[cubic-bezier(.25,1.2,.5,1)]"
              style={{ left: aNivel ? "50%" : "22%" }}
            />
          </span>
        </span>
        <Ojo inclinado />
        <span className="self-stretch justify-self-stretch border-l-[1.5px] border-uva-text bg-[repeating-linear-gradient(45deg,var(--uva-text)_0_1px,transparent_1px_5px)]" />
      </div>

      <span className="absolute inset-x-0 top-[60px] h-3 border-x border-uva-text-muted">
        <span className="absolute inset-x-0 top-1.5 border-t border-uva-text-muted" />
        <span className="absolute -top-px left-1/2 -translate-x-1/2 bg-uva-surface px-2 text-[11px] leading-[1.2] font-semibold tracking-[0.04em] text-uva-text-muted">
          600 mm
        </span>
      </span>
    </div>
  );
}

function Ojo({ inclinado = false }: { inclinado?: boolean }) {
  return (
    <span className="grid size-5 place-items-center rounded-full border-[1.5px] border-uva-text">
      <span className={cn("relative block h-3 w-px bg-uva-text", inclinado && "rotate-45")}>
        <span className="absolute top-[3px] -left-0.5 size-[5px] rounded-full bg-uva-accent-2 ring-1 ring-uva-text" />
      </span>
    </span>
  );
}

function Raya({ className }: { className: string }) {
  return (
    <span
      className={cn(
        "absolute inset-y-0 w-1 bg-[linear-gradient(90deg,var(--uva-text)_0_1px,transparent_1px_3px,var(--uva-text)_3px_4px)]",
        className,
      )}
    />
  );
}
