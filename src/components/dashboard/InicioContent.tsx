import Link from "next/link";
import { Building2, Ruler, Calculator, HardHat, Layers, Radio } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { formatDuracion } from "@/lib/admin/format";
import { esPortadaReal } from "@/lib/media";
import type { ClaseEnProgreso, CategoriaConConteo } from "@/lib/dashboard";

const PORTADA_TRAMA = {
  backgroundColor: "#141417",
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(250,250,250,.045) 0 2px, transparent 2px 9px)",
};

// Sin tabla de íconos por categoría en el esquema: se rota un set fijo,
// puramente decorativo (no representa datos reales de la categoría).
const ICONOS_CATEGORIA = [Calculator, Building2, HardHat, Ruler, Layers];

export function InicioContent({
  nombre,
  sigueAprendiendo,
  categorias,
}: {
  nombre: string;
  sigueAprendiendo: ClaseEnProgreso[];
  categorias: CategoriaConConteo[];
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {sigueAprendiendo.map((clase) => (
              <Link
                key={clase.leccionId}
                href={`/cursos/${clase.cursoId}`}
                className="group flex flex-col rounded-uva-md border border-uva-divider bg-uva-surface p-3 hover:border-uva-text-faint"
              >
                <div
                  className="relative h-[100px] overflow-hidden rounded-uva-sm"
                  style={esPortadaReal(clase.imagenPortada) ? undefined : PORTADA_TRAMA}
                >
                  {esPortadaReal(clase.imagenPortada) && (
                    // eslint-disable-next-line @next/next/no-img-element -- imagen de Supabase Storage
                    <img
                      src={clase.imagenPortada}
                      alt=""
                      className="absolute inset-0 size-full object-cover"
                    />
                  )}
                  <span className="absolute top-2 left-2 rounded-full bg-uva-accent-soft px-2 py-0.5 text-[10px] text-uva-accent-text">
                    En curso
                  </span>
                  <div className="absolute right-2 bottom-2 left-2">
                    <Progress value={clase.progreso} />
                  </div>
                </div>
                <span className="mt-2 font-mono text-[10px] tracking-[.08em] text-uva-text-faint uppercase">
                  {clase.categoriaNombre}
                </span>
                <h3 className="mt-0.5 truncate text-sm text-uva-text">{clase.cursoTitulo}</h3>
                <p className="truncate text-xs text-uva-text-muted">{clase.moduloTitulo}</p>
                <p className="mt-1 font-mono text-[11px] text-uva-text-faint tabular-nums">
                  {formatDuracion(clase.segundoActual)}/{formatDuracion(clase.duracion)}
                </p>
              </Link>
            ))}
          </div>
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
                  href={`/dashboard/catalogo/${categoria.id}`}
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

      {sigueAprendiendo.length === 0 && categorias.length === 0 && (
        <p className="text-sm text-uva-text-muted">
          Todavía no hay cursos publicados. Vuelve pronto.
        </p>
      )}
    </div>
  );
}
