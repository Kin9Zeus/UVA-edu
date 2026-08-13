import Link from "next/link";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[900px] px-[clamp(20px,4vw,56px)] py-24 text-center">
      <h2 className="mb-5 text-[clamp(30px,4.4vw,52px)] leading-[1.15] font-bold tracking-[-0.02em] text-uva-text">
        <span className="bg-[linear-gradient(96deg,var(--uva-accent)_0%,var(--uva-accent-warm)_52%,var(--uva-accent-2)_100%)] bg-clip-text text-transparent">
          Más de 400 empresas
        </span>{" "}
        usan U.V.A. para la formación de sus equipos
      </h2>
      <p className="mb-9 text-base text-uva-text-muted">
        Súmate al gremio que ya está subiendo el estándar técnico de sus
        proyectos.
      </p>
      <Link
        href="/login"
        className="inline-flex items-center justify-center rounded-full bg-uva-accent px-[46px] py-[17px] text-[15px] font-bold text-uva-text no-underline shadow-[0_10px_30px_rgba(255,0,122,0.28)] transition-[filter] duration-[160ms] [transition-timing-function:ease] hover:brightness-[1.08] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
      >
        Iniciar sesión
      </Link>
    </section>
  );
}
