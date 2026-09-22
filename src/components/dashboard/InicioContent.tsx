import Link from "next/link";
import Image from "next/image";
import { MiniaturaMux } from "@/components/features/MiniaturaMux";
import { Building2, Ruler, Calculator, HardHat, Layers, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatHoras } from "@/lib/admin/format";
import { AnilloProgreso } from "@/components/dashboard/AnilloProgreso";
import { formatDuracion } from "@/lib/admin/format";
import { esPortadaReal } from "@/lib/media";
import type { ClaseEnProgreso, CategoriaConConteo } from "@/lib/dashboard";
import type { CursoDestacado } from "@/lib/cursoDestacado";

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

const NIVEL_LABEL = { BASICO: "Básico", INTERMEDIO: "Intermedio", AVANZADO: "Avanzado" } as const;

// Sin tabla de íconos por categoría en el esquema: se rota un set fijo,
// puramente decorativo (no representa datos reales de la categoría).
const ICONOS_CATEGORIA = [Calculator, Building2, HardHat, Ruler, Layers];

export function InicioContent({
  nombre,
  sigueAprendiendo,
  categorias,
  cursoDestacado,
}: {
  nombre: string;
  sigueAprendiendo: ClaseEnProgreso[];
  categorias: CategoriaConConteo[];
  cursoDestacado: CursoDestacado | null;
}) {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? nombre;

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-10 px-[clamp(20px,3vw,44px)] py-8">
      <div>
        <h1 className="text-2xl text-uva-text">
          Hola {primerNombre}, tienes metas que alcanzar.
        </h1>
        <p className="mt-1 text-sm text-uva-text-muted">
          Retoma donde quedaste o explora algo nuevo del gremio.
        </p>
      </div>

      {sigueAprendiendo.length > 0 && (
        <section>
          <h2 className="mb-4 text-base text-uva-text">Sigue aprendiendo</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sigueAprendiendo.map((clase) => (
              <Link
                key={clase.leccionId}
                href={`/cursos/${clase.cursoSlug}/${clase.leccionSlug}`}
                className="group flex flex-col gap-2.5"
              >
                {/* Mismo tratamiento que la tarjeta de Progreso: sin marco,
                    la miniatura sostiene la pieza y la barra va a ras de
                    ella. Sin chip "En curso" —la sección se titula "Sigue
                    aprendiendo", decirlo otra vez en cada tarjeta sobra— ni
                    chips de categoría: aquí ya son tus cursos, no estás
                    eligiendo cuál tomar. */}
                <div
                  className="relative aspect-video overflow-hidden rounded-uva-md bg-uva-surface-2 ring-1 ring-uva-divider transition-[box-shadow] group-hover:ring-uva-text-faint"
                  style={
                    !clase.reanudarEn && !esPortadaReal(clase.imagenPortada)
                      ? PORTADA_TRAMA
                      : undefined
                  }
                >
                  {clase.reanudarEn ? (
                    <MiniaturaMux
                      src={clase.reanudarEn.url}
                      className="absolute inset-0 size-full object-cover"
                      respaldo={
                        esPortadaReal(clase.imagenPortada) && (
                          <Image
                            src={clase.imagenPortada}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                            className="object-cover"
                          />
                        )
                      }
                    />
                  ) : (
                    esPortadaReal(clase.imagenPortada) && (
                      <Image
                        src={clase.imagenPortada}
                        alt=""
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                        className="object-cover"
                      />
                    )
                  )}
                  {clase.reanudarEn && (
                    <span className="absolute top-2 right-2 rounded-uva-xs bg-black/75 px-1.5 py-0.5 font-mono text-[10.5px] tabular-nums text-white">
                      {formatDuracion(clase.reanudarEn.segundo)}
                      {clase.reanudarEn.duracion
                        ? ` / ${formatDuracion(clase.reanudarEn.duracion)}`
                        : ""}
                    </span>
                  )}
                  {clase.progreso > 0 && (
                    <div
                      className="absolute inset-x-0 bottom-0 h-[5px] bg-black/55"
                      role="progressbar"
                      aria-valuenow={clase.progreso}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${clase.clasesCompletadas} de ${clase.totalClases} clases`}
                    >
                      <div
                        className="h-full bg-uva-accent"
                        style={{ width: `${clase.progreso}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-start justify-between gap-2.5">
                    <h3 className="line-clamp-2 text-sm leading-snug text-uva-text transition-colors group-hover:text-uva-accent">
                      {clase.cursoTitulo}
                    </h3>
                    <AnilloProgreso
                      porcentaje={clase.progreso}
                      etiqueta={`${clase.clasesCompletadas} de ${clase.totalClases} clases`}
                    />
                  </div>
                  {/* Un solo renglón de apoyo, igual que en Progreso. Antes
                      eran tres —módulo, y aparte nivel · duración · clases— y
                      leídos en columna estrecha parecían datos sueltos sin
                      relación. Nivel y duración salieron: son datos para
                      ELEGIR curso, y aquí ya lo elegiste. */}
                  <p className="-mt-0.5 truncate font-mono text-[11px] text-uva-text-faint tabular-nums">
                    {clase.moduloTitulo} · {clase.clasesCompletadas}/{clase.totalClases} clases
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {sigueAprendiendo.length === 0 && cursoDestacado && (
        <section>
          <h2 className="mb-4 text-base text-uva-text">Curso recomendado para ti</h2>
          <Link
            href={`/cursos/${cursoDestacado.slug}`}
            className="group flex max-w-[380px] flex-col rounded-uva-md border border-uva-divider bg-uva-surface p-3 hover:border-uva-text-faint"
          >
            <div
              className="relative aspect-video overflow-hidden rounded-uva-sm"
              style={esPortadaReal(cursoDestacado.imagenPortada) ? undefined : PORTADA_TRAMA}
            >
              {esPortadaReal(cursoDestacado.imagenPortada) && (
                <Image
                  src={cursoDestacado.imagenPortada}
                  alt=""
                  fill
                  sizes="380px"
                  className="object-cover"
                />
              )}
              <span className="absolute top-2 left-2 rounded-full bg-uva-accent-soft px-2 py-0.5 text-[10px] text-uva-accent-text">
                Destacado
              </span>
            </div>
            <span className="mt-2 font-mono text-[10px] tracking-[.08em] text-uva-text-faint uppercase">
              {NIVEL_LABEL[cursoDestacado.nivel]}
            </span>
            <h3 className="mt-0.5 text-sm text-uva-text">{cursoDestacado.titulo}</h3>
            <p className="mt-1 line-clamp-2 text-xs text-uva-text-muted">{cursoDestacado.descripcion}</p>
            <div className="mt-2 flex items-center gap-2 font-mono text-[10px] tracking-[.06em] text-uva-text-faint uppercase">
              <span>
                {cursoDestacado.totalClases} {cursoDestacado.totalClases === 1 ? "clase" : "clases"}
              </span>
              <span aria-hidden>·</span>
              <span>{formatHoras(cursoDestacado.duracionTotalSegundos)}</span>
            </div>
          </Link>
        </section>
      )}

      {/* Webinars en vivo: sin tabla en el esquema todavía. Se deja con
          contenido de ejemplo a propósito hasta que exista el módulo real. */}
      <section>
        <div className="relative overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(110deg,color-mix(in_srgb,var(--uva-accent)_22%,transparent),color-mix(in_srgb,var(--uva-accent-2)_12%,transparent))] px-7 py-6">
          <span className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-uva-accent-soft px-2.5 py-1 text-[11px] text-uva-accent-text">
            <Radio className="size-3" />
            Evento en vivo
          </span>
          <h3 className="mt-1.5 mb-1.5 text-lg text-uva-text">
            Webinar: actualización NSR-10 y su impacto en presupuestos
          </h3>
          <p className="max-w-[440px] text-[13.5px] text-uva-text-muted">
            Con el equipo técnico de Uva. Incluye plantilla de reajuste de precios.
          </p>
          <Button variant="uva-primary" size="uva" className="mt-4 w-auto px-5" disabled>
            Próximamente
          </Button>
        </div>
      </section>

      {categorias.length > 0 && (
        <section>
          <h2 className="mb-4 text-base text-uva-text">Explora por categoría</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categorias.map((categoria, index) => {
              const Icon = ICONOS_CATEGORIA[index % ICONOS_CATEGORIA.length];
              const esFucsia = index % 2 === 0;
              return (
                <Link
                  key={categoria.id}
                  href={`/dashboard/catalogo/${categoria.slug}`}
                  className={`flex flex-col justify-between rounded-uva-md border border-uva-divider p-4 transition-colors ${
                    esFucsia ? "hover:border-uva-accent" : "hover:border-uva-accent-2"
                  }`}
                  style={{
                    background: esFucsia
                      ? "linear-gradient(160deg, color-mix(in oklch, var(--color-uva-accent) 16%, var(--color-uva-surface)) 0%, var(--color-uva-surface) 70%)"
                      : "linear-gradient(160deg, color-mix(in oklch, var(--color-uva-accent-2) 16%, var(--color-uva-surface)) 0%, var(--color-uva-surface) 70%)",
                  }}
                >
                  <Icon
                    className={`size-5 ${esFucsia ? "text-uva-accent" : "text-uva-accent-2"}`}
                    strokeWidth={1.9}
                  />
                  <div className="mt-6">
                    <p className="text-sm text-uva-text">{categoria.nombre}</p>
                    <p className="text-xs text-uva-text-faint">
                      {categoria.cursos} {categoria.cursos === 1 ? "curso" : "cursos"}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {sigueAprendiendo.length === 0 && !cursoDestacado && categorias.length > 0 && (
        <p className="-mt-6 text-sm text-uva-text-muted">
          Todavía no tienes cursos en progreso. Explora el catálogo abajo y arranca con el primero.
        </p>
      )}

      {sigueAprendiendo.length === 0 && categorias.length === 0 && (
        <p className="text-sm text-uva-text-muted">
          Todavía no hay cursos publicados. Vuelve pronto.
        </p>
      )}
    </div>
  );
}
