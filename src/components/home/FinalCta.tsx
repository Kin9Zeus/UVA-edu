import Link from "next/link";

export function FinalCta() {
  return (
    <section className="final-cta">
      <h2>
        <span className="gradient-text">Más de 400 empresas</span> usan
        U.V.A. para la formación de sus equipos
      </h2>
      <p>
        Súmate al gremio que ya está subiendo el estándar técnico de sus
        proyectos.
      </p>
      <Link href="/login" className="btn-cta">
        Iniciar sesión
      </Link>
    </section>
  );
}
