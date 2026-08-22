import Link from "next/link";
import { createPublicClient } from "@/lib/supabase/public";
import {
  type PlanRow,
  sharedBenefits,
  BENEFICIOS_POR_NIVEL,
  BENEFICIOS_POR_DEFECTO,
  formatearPrecio,
  periodo,
  meta,
  ahorroEnMeses,
} from "@/lib/planes";

const solidCta =
  "inline-flex h-10 w-full items-center justify-center rounded-uva-md bg-uva-accent px-5 text-sm font-semibold text-uva-text no-underline hover:bg-uva-accent-hover hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";
const outlineCta =
  "inline-flex h-11 w-full items-center justify-center rounded-uva-md border border-uva-divider bg-transparent px-6 text-sm font-semibold text-uva-text no-underline hover:bg-[#1c1c20] hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

export async function Pricing({
  titulo = "Planes para cada etapa del gremio",
  subtitulo = "Elige el ritmo de tu equipo. Cambia o cancela cuando quieras.",
}: {
  titulo?: string;
  subtitulo?: string;
} = {}) {
  const supabase = createPublicClient();

  // Solo planes vendibles y en el orden que definió el admin. La policy
  // `planes_select_publico` (supabase/sql/003) ya filtra por `activo`, pero el
  // `.eq()` explícito deja la intención en el código y no depende de que un
  // cambio futuro de la policy la conserve.
  const { data, error } = await supabase
    .from("planes")
    .select(
      "id, nombre, descripcion, precio_centavos, moneda, duracion_dias, nivel_acceso",
    )
    .eq("activo", true)
    .order("orden", { ascending: true });

  if (error) {
    console.error(
      "[Home/Pricing] No se pudieron cargar los planes:",
      error.message,
    );
  }

  const planes: PlanRow[] = data ?? [];

  // Referencia para el badge de ahorro: el plan activo más corto.
  const referencia = planes.reduce<PlanRow | null>(
    (menor, plan) =>
      !menor || plan.duracion_dias < menor.duracion_dias ? plan : menor,
    null,
  );

  // Destacado: el mejor precio por día entre los planes activos. Es la misma
  // idea que el diseño resalta a mano, pero se recalcula sola si cambian los
  // precios o entra un plan nuevo.
  const destacado = planes.reduce<PlanRow | null>(
    (mejor, plan) =>
      !mejor ||
      plan.precio_centavos / plan.duracion_dias <
        mejor.precio_centavos / mejor.duracion_dias
        ? plan
        : mejor,
    null,
  );

  return (
    <section
      id="planes"
      className="mx-auto max-w-[1180px] px-[clamp(20px,4vw,56px)] py-[clamp(72px,10vw,112px)]"
    >
      <div className="mb-11 text-center">
        <h2 className="mb-2 text-[clamp(28px,4vw,40px)] font-bold tracking-[-0.02em] text-uva-text">
          {titulo}
        </h2>
        <p className="m-0 text-base text-uva-text-muted">{subtitulo}</p>
      </div>

      {planes.length === 0 ? (
        <div className="mx-auto max-w-[1000px] rounded-uva-lg border border-uva-divider bg-uva-surface px-7 py-9 text-center">
          <p className="m-0 text-sm text-uva-text-muted">
            Estamos actualizando los planes. Escríbenos y te contamos las
            opciones disponibles.
          </p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1000px] grid-cols-[repeat(auto-fit,minmax(280px,1fr))] items-stretch gap-7">
          {planes.map((plan) => {
            const featured = plan.id === destacado?.id;
            const badge = referencia ? ahorroEnMeses(plan, referencia) : null;
            const incluidos =
              BENEFICIOS_POR_NIVEL[plan.nivel_acceso ?? ""] ??
              BENEFICIOS_POR_DEFECTO;
            // El diseño ofrece 4 cuotas sin interés en los planes largos.
            const cuotas =
              plan.duracion_dias >= 360
                ? `o 4 cuotas de ${formatearPrecio(
                    plan.precio_centavos / 4,
                    plan.moneda,
                  )} sin interés`
                : null;

            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-uva-lg border px-7 py-9 ${
                  featured
                    ? "border-uva-accent bg-[color-mix(in_srgb,var(--uva-accent)_8%,var(--uva-surface))]"
                    : "border-uva-divider bg-uva-surface"
                }`}
              >
                {badge && (
                  <span className="mb-3.5 self-start rounded-uva-xs bg-uva-accent-2-soft px-2.5 py-1 font-mono text-[10px] tracking-[0.1em] text-uva-accent-2-text uppercase">
                    {badge}
                  </span>
                )}
                <h3 className="mb-1 font-heading text-xl font-bold text-uva-text">
                  {plan.nombre}
                </h3>
                <p className="mb-5 text-[12.5px] text-uva-text-faint">
                  {meta(plan)}
                </p>
                <p className="mb-0.5 font-mono text-[28px] tabular-nums text-uva-text">
                  {formatearPrecio(plan.precio_centavos, plan.moneda)}{" "}
                  <span className="font-sans text-[13px] text-uva-text-muted">
                    {periodo(plan.duracion_dias)}
                  </span>
                </p>
                {cuotas && (
                  <p className="mb-7 text-xs text-uva-text-faint">{cuotas}</p>
                )}

                <ul className="mb-9 flex flex-1 flex-col gap-2.5">
                  {sharedBenefits.map((benefit, index) => {
                    const included = index < incluidos;
                    return (
                      <li
                        key={benefit}
                        className={`flex items-center gap-2.5 text-[13.5px] ${
                          included ? "text-uva-text" : "text-uva-text-disabled"
                        }`}
                      >
                        <span
                          className={
                            included
                              ? "shrink-0 text-uva-accent-2-text"
                              : "shrink-0 text-uva-text-disabled"
                          }
                          aria-hidden
                        >
                          –
                        </span>
                        {benefit}
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href="/registro"
                  className={featured ? solidCta : outlineCta}
                >
                  Suscribirme
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
