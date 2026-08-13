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
    <section className="product-band" id="producto">
      <div className="product-band__inner">
        <div className="product-band__head">
          <h2>Todo lo que necesita tu equipo, en un solo lugar</h2>
          <a href="#demo" className="btn-outline">
            Agenda una demo
          </a>
        </div>

        <div className="product-band__grid">
          <ul className="product-band__benefits">
            {benefits.map((benefit) => (
              <li className="product-band__benefit" key={benefit.title}>
                <span className="product-band__benefit-bullet" aria-hidden="true">
                  ▸
                </span>
                <div>
                  <p className="product-band__benefit-title">
                    {benefit.title}
                  </p>
                  <p className="product-band__benefit-desc">{benefit.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div
            className="product-band__shot"
            role="img"
            aria-label="Vista previa de la plataforma U.V.A."
          />
        </div>
      </div>
    </section>
  );
}
