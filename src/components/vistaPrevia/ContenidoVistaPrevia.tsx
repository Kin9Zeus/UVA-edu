import Link from "next/link";
import { PlayCircle } from "lucide-react";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { esPortadaReal } from "@/lib/media";
import type { CursoVistaPrevia } from "@/lib/admin/resolverVistaPrevia";

const NIVEL_LABEL = {
  BASICO: "Básico",
  INTERMEDIO: "Intermedio",
  AVANZADO: "Avanzado",
} as const;

/** "1h 05m" / "12m" a partir de segundos. */
function formatearDuracion(segundos: number | null): string | null {
  if (!segundos) return null;
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  return horas > 0 ? `${horas}h ${String(minutos).padStart(2, "0")}m` : `${minutos}m`;
}

/**
 * Ficha del curso tal como la vería un estudiante: portada, datos y
 * temario. Cada clase enlaza a su propia vista previa del reproductor
 * (LeccionVistaPreviaContent) — sin video real ni descargas, sirve para
 * revisar cómo queda montada la clase antes de publicar el curso.
 */
export function ContenidoVistaPrevia({
  curso,
  token,
}: {
  curso: CursoVistaPrevia;
  token: string;
}) {
  const totalClases = curso.modulos.reduce(
    (total, modulo) => total + modulo.lecciones.length,
    0,
  );

  return (
    <div className="mx-auto flex max-w-[880px] flex-col gap-6 px-[clamp(20px,4vw,40px)] py-10">
      <div className="flex flex-col gap-4">
        {esPortadaReal(curso.imagenPortada) ? (
          // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage
          <img
            src={curso.imagenPortada}
            alt=""
            className="aspect-video w-full rounded-uva-md object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="flex aspect-video w-full items-center justify-center rounded-uva-md bg-uva-surface-2 text-[13px] text-uva-muted-2"
          >
            Este curso todavía no tiene portada
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2.5">
          <StatusBadge tone={curso.mostrado ? "success" : "warning"}>
            {curso.mostrado ? "Publicado" : "Borrador"}
          </StatusBadge>
          <StatusBadge tone="neutral">{NIVEL_LABEL[curso.nivel]}</StatusBadge>
          <span className="text-[13px] text-uva-muted">{curso.instructorNombre}</span>
        </div>

        <h1 className="font-heading text-[28px] font-bold tracking-[-0.02em] text-uva-text">
          {curso.titulo}
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-uva-muted">{curso.descripcion}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-lg font-bold text-uva-text">Temario</h2>
          <span className="font-mono text-[12px] text-uva-muted-2">
            {curso.modulos.length} módulo(s) · {totalClases} clase(s)
          </span>
        </div>

        {curso.modulos.length === 0 && (
          <p className="text-[13.5px] text-uva-muted-2">
            Este curso todavía no tiene contenido cargado.
          </p>
        )}

        {curso.modulos.map((modulo, indice) => (
          <div
            key={modulo.id}
            className="rounded-uva-md border border-uva-divider bg-uva-surface px-4 py-3.5"
          >
            <p className="m-0 text-sm font-semibold text-uva-text">
              <span className="font-mono text-uva-muted-2">
                {String(indice + 1).padStart(2, "0")}
              </span>{" "}
              {modulo.titulo}
            </p>

            {modulo.lecciones.length === 0 ? (
              <p className="mt-2 text-xs text-uva-text-faint">Módulo sin lecciones.</p>
            ) : (
              <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
                {modulo.lecciones.map((leccion) => {
                  const duracion = formatearDuracion(leccion.duracion);
                  return (
                    <li key={leccion.id}>
                      <Link
                        href={`/vista-previa/${token}/${leccion.id}`}
                        className="flex items-center justify-between gap-3 rounded-uva-sm px-1.5 py-1 text-[13px] text-uva-muted no-underline hover:bg-uva-hover hover:text-uva-text"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <PlayCircle className="size-3.5 shrink-0 text-uva-text-faint" strokeWidth={1.8} />
                          <span className="truncate">{leccion.titulo}</span>
                        </span>
                        {duracion && (
                          <span className="shrink-0 font-mono text-[11.5px] text-uva-text-faint">
                            {duracion}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
