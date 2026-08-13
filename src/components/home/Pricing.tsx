import Link from "next/link";
import { CheckIcon, CrossIcon } from "@/components/home/icons";

const sharedBenefits = [
  "Catálogo completo",
  "Certificados digitales",
  "Plantillas y planos descargables",
  "Certificado físico de rutas",
  "Eventos y webinars en vivo",
];

interface Plan {
  id: string;
  badge?: string;
  name: string;
  meta: string;
  price: string;
  period: string;
  note?: string;
  featured?: boolean;
  includedCount: number;
  ctaVariant: "solid" | "outline";
}

const plans: Plan[] = [
  {
    id: "basic",
    name: "Basic",
    meta: "Mensual · 1 estudiante",
    price: "$59.900",
    period: "/mes",
    includedCount: 2,
    ctaVariant: "outline",
  },
  {
    id: "expert",
    badge: "Ahorras 5 meses",
    name: "Expert",
    meta: "Anual · 1 estudiante",
    price: "$449.900",
    period: "/año",
    note: "o 4 cuotas de $112.475 sin interés",
    featured: true,
    includedCount: 5,
    ctaVariant: "solid",
  },
  {
    id: "expert-duo",
    badge: "Ahorras 7 meses",
    name: "Expert Duo",
    meta: "Anual · 2 estudiantes",
    price: "$749.900",
    period: "/año",
    note: "o 4 cuotas de $187.475 sin interés",
    includedCount: 5,
    ctaVariant: "outline",
  },
];

const solidCta =
  "inline-flex h-10 w-full items-center justify-center rounded-uva-md bg-uva-accent px-5 text-sm font-semibold text-uva-text no-underline hover:bg-uva-accent-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";
const outlineCta =
  "inline-flex h-11 w-full items-center justify-center rounded-uva-md border border-uva-divider bg-transparent px-6 text-sm font-semibold text-uva-text no-underline hover:bg-[#1c1c20] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

export function Pricing() {
  return (
    <section id="planes" className="mx-auto max-w-[1180px] px-[clamp(20px,4vw,56px)] py-[clamp(72px,10vw,112px)]">
      <div className="mb-11 text-center">
        <h2 className="mb-2 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.02em] text-uva-text">
          Planes para cada etapa del gremio
        </h2>
        <p className="m-0 text-base text-uva-text-muted">
          Elige el ritmo de tu equipo. Cambia o cancela cuando quieras.
        </p>
      </div>

      <div className="mx-auto grid max-w-[1000px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-stretch gap-7">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-uva-lg border px-7 py-9 ${
              plan.featured
                ? "border-uva-accent bg-[color-mix(in_srgb,var(--uva-accent)_8%,var(--uva-surface))]"
                : "border-uva-divider bg-uva-surface"
            }`}
          >
            {plan.badge && (
              <span className="mb-3.5 self-start rounded-uva-xs bg-uva-accent-2-soft px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] text-uva-accent-2-text uppercase">
                {plan.badge}
              </span>
            )}
            <h3 className="mb-1 font-heading text-xl font-bold text-uva-text">
              {plan.name}
            </h3>
            <p className="mb-5 text-[12.5px] text-uva-text-faint">
              {plan.meta}
            </p>
            <p className="mb-0.5 font-mono text-[28px] tabular-nums text-uva-text">
              {plan.price}{" "}
              <span className="font-sans text-[13px] text-uva-text-muted">
                {plan.period}
              </span>
            </p>
            {plan.note && (
              <p className="mb-7 text-xs text-uva-text-faint">{plan.note}</p>
            )}

            <ul className="mb-9 flex flex-1 flex-col gap-2.5">
              {sharedBenefits.map((benefit, index) => {
                const included = index < plan.includedCount;
                return (
                  <li
                    key={benefit}
                    className={`flex items-center gap-2.5 text-[13.5px] ${
                      included ? "text-uva-text" : "text-uva-text-disabled"
                    }`}
                  >
                    {included ? (
                      <CheckIcon className="shrink-0 text-uva-accent-2-text" />
                    ) : (
                      <CrossIcon className="shrink-0 text-uva-text-disabled" />
                    )}
                    {benefit}
                  </li>
                );
              })}
            </ul>

            <Link
              href="/registro"
              className={plan.ctaVariant === "solid" ? solidCta : outlineCta}
            >
              Suscribirme
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
