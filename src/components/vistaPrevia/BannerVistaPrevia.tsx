import { Eye } from "lucide-react";

/**
 * Indicador permanente de modo vista previa (Revcurso, requisito 5:
 * "indicador claro y permanente [...] para que no confunda entornos").
 *
 * Decisiones que lo hacen difícil de pasar por alto:
 *  - `fixed` arriba del todo, no `sticky`: no desaparece al hacer scroll.
 *  - Magenta de acento sobre el fondo oscuro — el mismo color que la marca
 *    reserva para lo que exige atención.
 *  - El `<body>` recibe un padding superior equivalente desde el layout,
 *    para que la barra no tape el contenido en vez de convivir con él.
 */
export function BannerVistaPrevia({
  publicado,
  expiraEn,
}: {
  /** Un curso ya publicado también puede abrirse por enlace; el aviso cambia. */
  publicado: boolean;
  expiraEn: Date;
}) {
  const formateador = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-uva-accent px-4 py-2 text-center text-[13px] font-semibold text-white"
    >
      <span className="flex items-center gap-1.5">
        <Eye className="size-4 shrink-0" aria-hidden />
        Modo vista previa
        {!publicado && " · este curso todavía no está publicado"}
      </span>
      <span className="font-mono text-[11.5px] font-normal opacity-90">
        el enlace caduca el {formateador.format(expiraEn)}
      </span>
    </div>
  );
}
