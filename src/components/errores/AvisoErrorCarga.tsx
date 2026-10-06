import { cn } from "@/lib/utils";

/**
 * Aviso en línea para un bloque que no se pudo cargar (comentarios, notas,
 * notificaciones), con Reintentar. Es el "estado de error" que el piso de
 * calidad pide junto a cargando, vacío y con datos (CLAUDE.md 3.4): sin él, un
 * fallo de la base se confunde con "no hay nada" ("Sé el primero en
 * comentar", "No tienes notificaciones") y el usuario cree que lo perdió.
 *
 * Es para bloques SECUNDARIOS de una pantalla que sigue siendo útil. Si lo que
 * falla es el contenido principal, se lanza el error (`lanzarSiFalla`) y lo
 * atrapa `error.tsx`.
 */
export function AvisoErrorCarga({
  texto,
  onReintentar,
  className,
}: {
  texto: string;
  onReintentar: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-start gap-2 rounded-uva-md border border-uva-divider bg-uva-surface-2 p-3.5",
        className,
      )}
    >
      <p className="m-0 text-[13px] leading-snug text-uva-text-muted">{texto}</p>
      <button
        type="button"
        onClick={onReintentar}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-uva-md border border-uva-divider bg-uva-surface px-4 text-[13px] font-semibold text-uva-text transition-colors hover:border-uva-dim"
      >
        Reintentar
      </button>
    </div>
  );
}
