import { cn } from "@/lib/utils";

/* `.badge-success` / `.badge-warn` / `.badge-danger` / `.badge-neutral` del
   mockup. `accent` no existe en el mockup: sobrevive por un unico uso en el
   detalle de usuario, que el bloque 6 pasara a neutral. */
const TONES = {
  success: "bg-uva-badge-success-bg text-uva-badge-success-fg",
  warning: "bg-uva-badge-warn-bg text-uva-badge-warn-fg",
  error: "bg-uva-badge-danger-bg text-uva-badge-danger-fg",
  neutral: "bg-uva-badge-neutral-bg text-uva-badge-neutral-fg",
  accent: "bg-uva-accent-soft text-uva-accent-text",
} as const;

export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONES;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // `.badge` del mockup: mono 11px/600, tracking .04em, radio 6px.
        "inline-flex w-fit items-center gap-1.5 rounded-[6px] px-[9px] py-1 font-mono text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
