import Link from "next/link";
import { getCifrasPublicas } from "@/lib/cifrasPublicas";

export async function AuthVisual() {
  // Mismas cifras que la portada y con la misma regla: sin cifras que pasen
  // su mínimo, el bloque no se renderiza (antes la primera salía sin número).
  const cifras = await getCifrasPublicas();

  return (
    <section
      aria-label="Presentación"
      className="relative z-[2] flex items-center px-6 pt-6 pb-2 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:flex-col min-[900px]:items-start min-[900px]:justify-between min-[900px]:overflow-hidden min-[900px]:bg-uva-surface/35 min-[900px]:p-11"
    >
      <Link
        href="/"
        className="relative z-[2] flex w-fit items-center font-heading text-2xl font-bold tracking-[0.1em] text-uva-text no-underline hover:text-uva-text hover:no-underline"
      >
        U.V.A<span className="text-uva-accent">.</span>
      </Link>

      {/* Mobile: sin hero — el degradado de fondo y el card flotante viven en
          page.tsx. Desktop: contenido completo, sin cambios. */}
      <div className="relative z-[2] hidden max-w-[490px] min-[900px]:block">
        <h1 className="mb-3.5 text-[34px] text-uva-text min-[900px]:text-[46px]">
          Aprende el oficio.
          <br />
          Presupuesta de verdad.
        </h1>
        <p className="max-w-[450px] text-base text-uva-text-muted">
          Formación para arquitectos, residentes de obra y presupuestadores.
          Cursos en video y plantillas que puedes usar mañana en la obra.
        </p>

        {cifras.length > 0 && (
          <div className="mt-[30px] flex flex-wrap gap-x-[26px] gap-y-3.5">
            {cifras.map((cifra) => (
              <div key={cifra.etiqueta}>
                <div className="font-heading text-[26px] text-uva-accent-ink">
                  {cifra.valor}
                </div>
                <div className="text-xs text-uva-text-faint">{cifra.etiqueta}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative z-[2] hidden text-xs text-uva-text-faint min-[900px]:block">
        Arquitectura, construcción y presupuestos
      </div>

      <div
        aria-hidden="true"
        className="absolute -right-[140px] -bottom-[120px] hidden h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle_at_35%_30%,color-mix(in_srgb,var(--uva-accent)_26%,transparent),transparent_70%)] min-[900px]:block"
      />
      <div
        aria-hidden="true"
        className="absolute top-[96px] right-[52px] hidden h-[188px] w-[188px] rounded-full opacity-50 bg-[radial-gradient(circle_at_60%_40%,color-mix(in_srgb,var(--uva-accent-2)_30%,transparent),color-mix(in_srgb,var(--uva-surface)_60%,transparent)_75%)] min-[900px]:block"
      />
    </section>
  );
}
