const benefits = [
  {
    title: "Clases cortas con entregable",
    desc: "Cada lección termina en algo que puedes usar en obra, no solo teoría.",
  },
  {
    title: "Rutas por cargo",
    desc: "Itinerarios pensados para arquitectos, residentes y presupuestadores.",
  },
  {
    title: "Plantillas y planos descargables",
    desc: "Recursos listos para aplicar en tus proyectos reales.",
  },
  {
    title: "Asistente técnico con IA",
    desc: "Resuelve dudas de obra y presupuesto en el momento que las tienes.",
  },
  {
    title: "Reportes de avance por colaborador",
    desc: "Visibilidad del progreso de cada integrante de tu equipo.",
  },
];

export function ProductBand() {
  return (
    <section
      id="producto"
      className="border-y border-uva-divider bg-[#0d0d10] px-[clamp(20px,4vw,56px)] py-[clamp(56px,8vw,96px)]"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-11 flex flex-col items-center gap-5 text-center">
          <h2 className="m-0 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.02em] text-uva-text">
            Todo lo que necesita tu equipo, en un solo lugar
          </h2>
          <a
            href="#demo"
            className="inline-flex h-11 items-center justify-center rounded-uva-md border border-uva-divider bg-transparent px-6 text-sm font-semibold text-uva-text no-underline hover:bg-[#1c1c20] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
          >
            Agenda una demo
          </a>
        </div>

        <div className="grid grid-cols-1 items-center gap-[clamp(32px,6vw,64px)] min-[900px]:grid-cols-2">
          <ul className="flex flex-col gap-5">
            {benefits.map((benefit) => (
              <li className="flex gap-2.5" key={benefit.title}>
                <span
                  className="shrink-0 font-bold text-uva-accent"
                  aria-hidden="true"
                >
                  ▸
                </span>
                <div>
                  <p className="mb-0.5 text-sm font-semibold text-uva-text">
                    {benefit.title}
                  </p>
                  <p className="m-0 text-[12.5px] text-uva-text-muted">
                    {benefit.desc}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <div
            role="img"
            aria-label="Vista previa de la plataforma U.V.A."
            className="order-[-1] h-[240px] rounded-uva-lg border border-uva-divider bg-[#141417] bg-[repeating-linear-gradient(135deg,rgba(250,250,250,0.045)_0_2px,transparent_2px_9px)] min-[900px]:order-none min-[900px]:h-[340px]"
          />
        </div>
      </div>
    </section>
  );
}
