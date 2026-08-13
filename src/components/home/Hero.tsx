import Link from "next/link";

const metrics = [
  { value: "12.400", label: "alumnos del gremio" },
  { value: "180+", label: "cursos técnicos" },
  { value: "10", label: "escuelas" },
];

export function Hero() {
  return (
    <section className="hero">
      <div className="hero__glow" aria-hidden="true" />
      <div className="hero__content">
        <h1>
          La escuela del oficio
          <span>de la construcción</span>
        </h1>
        <p className="hero__lead">
          Formación técnica para arquitectos, residentes de obra,
          presupuestadores y coordinadores BIM en toda LATAM.
        </p>

        <Link href="/login" className="btn-cta">
          Iniciar sesión
        </Link>

        <div className="hero__metrics">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <div className="hero__metric-value">{metric.value}</div>
              <div className="hero__metric-label">{metric.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
