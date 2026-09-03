import Link from "next/link";
import type { CursoDeCategoria } from "@/lib/categoria";
import { esPortadaReal } from "@/lib/media";

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

export function CursoCard({ curso }: { curso: CursoDeCategoria }) {
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
        <div className="absolute inset-x-3.5 bottom-3 flex items-center justify-end gap-1">
          {curso.completado && (
            <span className="rounded-uva-xs bg-uva-valid-soft px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.12em] text-uva-valid uppercase">
              Completado
            </span>
          )}
          <span className="rounded-uva-xs bg-uva-badge-neutral-bg px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-[.12em] text-uva-muted uppercase">
            Curso
          </span>
        </div>
      </div>
      <div className="px-4 pt-3.5 pb-2">
        {/* min-h reserva 2 líneas de categorías (nunca se corta una etiqueta
            a la mitad): en el caso común (1-2 categorías) la fila de
            nivel/clases de abajo queda igual de estable que con el título;
            un curso con 3+ categorías envuelve a una tercera línea y ahí sí
            puede desalinearse un poco frente a sus vecinas — se prefiere
            eso a truncar el texto. */}
        <div className="flex min-h-[38px] flex-wrap items-start gap-1">
          {curso.categorias.map((categoria) => (
            <span
              key={categoria.id}
              className="rounded-uva-xs bg-uva-accent-soft px-2 py-0.5 text-[10px] whitespace-nowrap text-uva-accent-text"
            >
              {categoria.nombre}
            </span>
          ))}
        </div>
        {/* min-h fija el bloque a 2 líneas siempre (leading-snug ≈ 1.375 ×
            13.5px × 2 ≈ 2.75em): un título de 1 línea no debe dejar la fila
            de nivel/clases de abajo más arriba que en una tarjeta vecina con
            título de 2 líneas — line-clamp-2 cubre el caso inverso (3+
            líneas). */}
        <h3 className="mt-2 line-clamp-2 min-h-[2.75em] text-[13.5px] leading-snug font-bold text-uva-text">
          {curso.titulo}
        </h3>
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
