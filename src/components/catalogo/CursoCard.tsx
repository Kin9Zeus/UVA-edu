import Link from "next/link";
import type { CursoDeCategoria } from "@/lib/categoria";
import { esPortadaReal } from "@/lib/media";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

export function CursoCard({
  curso,
  categoriaNombre,
}: {
  curso: CursoDeCategoria;
  categoriaNombre: string;
}) {
  return (
    <Link
      href={`/cursos/${curso.id}`}
      className="group flex flex-col overflow-hidden rounded-uva-md border border-uva-divider bg-uva-surface hover:border-uva-text-faint"
    >
      <div className="relative aspect-video" style={esPortadaReal(curso.imagenPortada) ? undefined : PORTADA_TRAMA}>
        {esPortadaReal(curso.imagenPortada) && (
          // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage
          <img
            src={curso.imagenPortada}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
        )}
        {esPortadaReal(curso.imagenPortada) && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
        )}
        <div className="absolute inset-x-3.5 bottom-3 flex items-center gap-2">
          <span className="font-mono text-[9.5px] font-semibold tracking-[.14em] text-uva-muted-2 uppercase">
            {categoriaNombre}
          </span>
          <span className="ml-auto rounded-uva-xs bg-uva-badge-neutral-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.12em] text-uva-muted uppercase">
            Curso
          </span>
        </div>
      </div>
      <div className="px-4 pt-3.5 pb-2">
        <h3 className="text-[13.5px] leading-snug font-bold text-uva-text">{curso.titulo}</h3>
        <p className="mt-1.5 truncate text-xs text-uva-muted-2">{curso.instructorNombre}</p>
      </div>
      <div className="flex items-center gap-2.5 px-4 pt-2.5 pb-3.5 font-mono text-[10px] font-medium tracking-[.12em] text-uva-muted uppercase">
        <span>{NIVEL_LABEL[curso.nivel]}</span>
        <span className="ml-auto">
          {curso.totalClases} {curso.totalClases === 1 ? "clase" : "clases"}
        </span>
      </div>
    </Link>
  );
}
