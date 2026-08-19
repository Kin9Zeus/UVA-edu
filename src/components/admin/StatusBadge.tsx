import { cn } from "@/lib/utils";

const TONES = {
  success: "bg-uva-valid-soft text-uva-valid",
  warning: "bg-uva-warning-soft text-uva-warning-text",
  error: "bg-uva-error-soft text-uva-error-text",
  accent: "bg-uva-accent-soft text-uva-accent-text",
  neutral: "bg-uva-divider text-uva-text-muted",
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
        "inline-flex w-fit items-center rounded-uva-xs px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
