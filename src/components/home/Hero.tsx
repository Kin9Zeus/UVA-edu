import Link from "next/link";
import { Button } from "@/components/ui/button";

const metrics = [
  { value: "12.400", label: "alumnos del gremio" },
  { value: "180+", label: "cursos técnicos" },
  { value: "10", label: "escuelas" },
];

export function Hero({ hrefCodigo }: { hrefCodigo: string }) {
  return (
    <section className="relative mx-auto max-w-[1180px] overflow-hidden px-[clamp(20px,4vw,56px)] pt-[clamp(72px,12vw,128px)] pb-[clamp(56px,8vw,96px)] text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-140px] left-1/2 z-0 h-[560px] w-[900px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(255,0,122,0.3)_0%,transparent_68%)]"
      />
      <div className="relative z-[1] flex flex-col items-center">
        <h1 className="mb-5 text-[clamp(44px,6vw,72px)] leading-[1.08] font-bold tracking-[-0.03em] text-uva-text">
          La escuela del oficio
          <span className="block text-uva-accent">de la construcción</span>
        </h1>
        <p className="mb-9 max-w-[560px] text-lg text-uva-text-muted">
          Formación técnica para arquitectos, residentes de obra,
          presupuestadores y coordinadores BIM en toda LATAM.
        </p>

        <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
          <Button
            render={<Link href={hrefCodigo} />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="min-h-12 px-8 sm:w-auto"
          >
            Tengo un código
          </Button>
          <Button
            render={<Link href="/catalogo" />}
            nativeButton={false}
            variant="uva-secondary"
            size="uva"
            className="min-h-12 border-uva-text-faint px-8 sm:w-auto"
          >
            Ver catálogo
          </Button>
        </div>

        <div className="mt-9 flex flex-wrap justify-center gap-[clamp(24px,4vw,48px)]">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="font-mono text-[28px] tabular-nums text-uva-text">
                {metric.value}
              </div>
              <div className="mt-1 text-[12.5px] text-uva-text-faint">
                {metric.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
