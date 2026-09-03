import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCursoDestacado } from "@/lib/cursoDestacado";
import { esPortadaReal } from "@/lib/media";
import { formatHoras } from "@/lib/admin/format";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

/**
 * Sin curso marcado `destacado` en el admin, la sección no se renderiza —
 * ver getCursoDestacado(). No hay banner de "próximamente" ni placeholder:
 * la landing simplemente pasa directo de Hero a ProductBand.
 */
export async function CursoDestacado() {
  const curso = await getCursoDestacado();
  if (!curso) return null;

  return (
    <section
      aria-labelledby="curso-destacado-heading"
      className="mx-auto max-w-[1180px] px-[clamp(20px,4vw,56px)] py-[clamp(56px,8vw,96px)]"
    >
      <div className="grid grid-cols-1 items-center gap-[clamp(32px,6vw,64px)] lg:grid-cols-2">
        {/* Zoom al pasar el mouse: puramente CSS (group-hover), sin JS ni
            "use client" — el resto de la sección no necesita interactividad. */}
        <div className="group order-1 overflow-hidden rounded-uva-lg border border-uva-divider">
          <div
            className="relative aspect-video"
            style={esPortadaReal(curso.imagenPortada) ? undefined : PORTADA_TRAMA}
          >
            {esPortadaReal(curso.imagenPortada) && (
              // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage
              <img
                src={curso.imagenPortada}
                alt=""
                className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
            )}
          </div>
        </div>

        <div className="order-2">
          <div className="mb-4 flex items-center gap-3">
            <span className="shrink-0 font-mono text-[11px] font-semibold tracking-[.16em] text-uva-accent uppercase">
              Curso destacado
            </span>
            <span aria-hidden="true" className="h-px flex-1 bg-uva-divider" />
          </div>

          <h2
            id="curso-destacado-heading"
            className="text-[clamp(28px,4vw,40px)] leading-[1.12] tracking-[-0.02em] text-uva-text"
          >
            {curso.titulo}
          </h2>

          <p className="mt-4 line-clamp-3 max-w-[480px] text-[15px] text-uva-text-muted">
            {curso.descripcion}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[11px] font-medium tracking-[.1em] text-uva-text-faint uppercase">
            <span>{NIVEL_LABEL[curso.nivel]}</span>
            <span aria-hidden="true">·</span>
            <span>
              {curso.totalClases} {curso.totalClases === 1 ? "clase" : "clases"}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatHoras(curso.duracionTotalSegundos)}</span>
          </div>

          <Button
            render={<Link href={`/cursos/${curso.id}`} />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="mt-7 w-auto gap-2 px-6"
          >
            Explorar curso
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </section>
  );
}
