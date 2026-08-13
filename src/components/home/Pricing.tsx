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

export function Pricing() {
  return (
    <section className="pricing" id="planes">
      <div className="pricing__head">
        <h2>Planes para cada etapa del gremio</h2>
        <p>Elige el ritmo de tu equipo. Cambia o cancela cuando quieras.</p>
      </div>

      <div className="pricing__grid">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`plan-card${plan.featured ? " plan-card--featured" : ""}`}
          >
            {plan.badge && (
              <span className="plan-card__badge">{plan.badge}</span>
            )}
            <h3 className="plan-card__name">{plan.name}</h3>
            <p className="plan-card__meta">{plan.meta}</p>
            <p className="plan-card__price">
              {plan.price} <span>{plan.period}</span>
            </p>
            {plan.note && <p className="plan-card__note">{plan.note}</p>}

            <ul className="plan-card__list">
              {sharedBenefits.map((benefit, index) => {
                const included = index < plan.includedCount;
                return (
                  <li
                    key={benefit}
                    className={`plan-card__item ${included ? "is-check" : "is-cross"}`}
                  >
                    {included ? <CheckIcon /> : <CrossIcon />}
                    {benefit}
                  </li>
                );
              })}
            </ul>

            <Link
              href="/registro"
              className={plan.ctaVariant === "solid" ? "btn-solid" : "btn-outline"}
            >
              Suscribirme
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
