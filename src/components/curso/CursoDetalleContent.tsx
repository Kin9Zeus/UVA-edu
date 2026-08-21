import Link from "next/link";
import { Lock, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatFecha } from "@/lib/admin/format";
import type { CursoPublico } from "@/lib/curso";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

function formatHoras(segundos: number) {
  if (segundos <= 0) return "—";
  const horas = Math.floor(segundos / 3600);
  const minutos = Math.round((segundos % 3600) / 60);
  if (horas === 0) return `${minutos} min`;
  if (minutos === 0) return `${horas} h`;
  return `${horas} h ${minutos} m`;
}

export function CursoDetalleContent({ curso }: { curso: CursoPublico }) {
  return (
    <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-[clamp(20px,4vw,56px)] py-[clamp(32px,5vw,56px)] lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-8">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <span className="rounded-uva-xs bg-uva-accent-soft px-2.5 py-1 text-xs text-uva-accent-text">
              {curso.categoriaNombre}
            </span>
            <span className="rounded-uva-xs bg-[#27272A] px-2.5 py-1 text-xs text-uva-text-muted">
              {NIVEL_LABEL[curso.nivel]}
            </span>
          </div>
          <h1 className="mb-3 text-[clamp(28px,3.4vw,40px)] leading-tight text-uva-text">
            {curso.titulo}
          </h1>
          <p className="max-w-[620px] text-[15px] text-uva-text-muted">{curso.descripcion}</p>

          <div className="mt-6 flex flex-wrap gap-6 rounded-uva-md bg-white/5 px-5 py-4">
            <div>
              <p className="font-heading text-xl text-uva-text">{curso.totalClases}</p>
              <p className="text-[11.5px] text-uva-text-faint">clases</p>
            </div>
            <div>
              <p className="font-heading text-xl text-uva-text">
                {formatHoras(curso.duracionTotalSegundos)}
              </p>
              <p className="text-[11.5px] text-uva-text-faint">contenido</p>
            </div>
            <div>
              <p className="font-heading text-xl text-uva-text">{curso.totalRecursos}</p>
              <p className="text-[11.5px] text-uva-text-faint">recursos descargables</p>
            </div>
            <div className="self-center text-[12.5px] text-uva-text-faint">
              Actualizado el {formatFecha(curso.fechaEdicion)}
            </div>
          </div>
        </div>

        <div>
          <h2 className="mb-3.5 text-base text-uva-text">Temario</h2>
          <div className="flex flex-col gap-4">
            {curso.modulos.map((modulo) => (
              <div key={modulo.id}>
                <div className="mb-2 flex items-center gap-2.5">
                  <p className="text-[13.5px] font-bold text-uva-text">{modulo.titulo}</p>
                  <span className="text-[11.5px] text-uva-text-faint">
                    {modulo.lecciones.length}{" "}
                    {modulo.lecciones.length === 1 ? "clase" : "clases"}
                  </span>
                </div>
                <div className="flex flex-col gap-px overflow-hidden rounded-uva-md bg-white/5">
                  {modulo.lecciones.map((leccion, index) => (
                    <div
                      key={leccion.id}
                      className="flex items-center gap-3 px-4 py-3 text-[13.5px] text-uva-text"
                    >
                      <span className="w-4 text-uva-text-faint">{index + 1}</span>
                      {curso.tieneAcceso ? (
                        <PlayCircle className="size-4 shrink-0 text-uva-text-faint" strokeWidth={1.8} />
                      ) : (
                        <Lock className="size-4 shrink-0 text-uva-text-faint" strokeWidth={1.8} />
                      )}
                      <span className="flex-1 truncate">{leccion.titulo}</span>
                      <span className="font-mono text-xs text-uva-text-faint tabular-nums">
                        {leccion.duracion ? formatHoras(leccion.duracion) : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="h-[196px] overflow-hidden rounded-uva-md" style={PORTADA_TRAMA} />

        {curso.tieneAcceso ? (
          <Button variant="uva-primary" size="uva" className="min-h-12" disabled>
            El reproductor llega pronto
          </Button>
        ) : (
          <Button
            render={<Link href="/planes" />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="min-h-12"
          >
            Suscríbete para verlo
          </Button>
        )}

        <div className="flex flex-col gap-3.5 rounded-uva-md border border-uva-divider bg-uva-surface p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#27272A] font-heading text-[15px] text-uva-text">
              {curso.instructorNombre
                .split(/\s+/)
                .slice(0, 2)
                .map((parte) => parte[0]?.toUpperCase())
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="font-heading text-[15px] text-uva-text">{curso.instructorNombre}</p>
              {curso.instructorEspecialidad && (
                <p className="text-[11.5px] text-uva-text-faint">{curso.instructorEspecialidad}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
