import { Button } from "@/components/ui/button";
import {
  type PlanRow,
  sharedBenefits,
  BENEFICIOS_POR_NIVEL,
  BENEFICIOS_POR_DEFECTO,
  formatearPrecio,
  periodo,
  meta,
  ahorroPorcentaje,
} from "@/lib/planes";

export function PlanesContent({ planes }: { planes: PlanRow[] }) {
  // Referencia para el badge de ahorro: el plan activo más corto (igual
  // criterio que la home pública, src/components/home/Pricing.tsx).
  const referencia = planes.reduce<PlanRow | null>(
    (menor, plan) =>
      !menor || plan.duracion_dias < menor.duracion_dias ? plan : menor,
    null,
  );

  // Destacado: el mejor precio por día entre los planes activos.
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
    <div>
      <div className="mb-[30px] text-center">
        <h1 className="mb-2 text-[38px] text-uva-text">Un plan, todo el gremio</h1>
        <p className="mx-auto mb-5 max-w-[520px] text-uva-text-muted">
          Acceso a los 180+ cursos, las plantillas descargables y los
          certificados. Precios en pesos colombianos, con IVA incluido.
        </p>
      </div>

      {planes.length === 0 ? (
        <div className="mx-auto max-w-[1000px] rounded-uva-md border border-uva-divider bg-uva-surface px-7 py-9 text-center">
          <p className="m-0 text-sm text-uva-text-muted">
            Estamos actualizando los planes. Escríbenos y te contamos las
            opciones disponibles.
          </p>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1160px] items-stretch gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
          {planes.map((plan) => {
            const featured = plan.id === destacado?.id;
            const badge = referencia ? ahorroPorcentaje(plan, referencia) : null;
            const incluidos =
              BENEFICIOS_POR_NIVEL[plan.nivel_acceso ?? ""] ??
              BENEFICIOS_POR_DEFECTO;
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
                className={
                  featured
                    ? "flex flex-col gap-3.5 rounded-uva-md border border-uva-accent/55 bg-uva-accent/12 p-6 shadow-lg"
                    : "flex flex-col gap-3.5 rounded-uva-md border border-uva-divider bg-uva-surface p-6"
                }
              >
                <div className="flex items-center gap-2">
                  <div>
                    <div className="font-heading text-xl text-uva-text">
                      {plan.nombre}
                    </div>
                    <div className="text-xs text-uva-text-faint">{meta(plan)}</div>
                  </div>
                  {badge && (
                    <span className="ml-auto shrink-0 rounded-full bg-uva-accent-soft px-2.5 py-1 text-[11px] text-uva-accent-text">
                      {badge}
                    </span>
                  )}
                </div>

                <div>
                  <span className="font-heading text-[32px] text-uva-text">
                    {formatearPrecio(plan.precio_centavos, plan.moneda)}
                  </span>
                  <span className="text-[13px] text-uva-text-faint">
                    {" "}
                    {periodo(plan.duracion_dias)}
                  </span>
                  {cuotas && (
                    <p className="mt-0.5 text-xs text-uva-text-faint">{cuotas}</p>
                  )}
                </div>

                <Button
                  type="button"
                  variant={featured ? "uva-primary" : "uva-secondary"}
                  size="uva"
                >
                  Elegir {plan.nombre}
                </Button>

                <div className="flex flex-col gap-1.5 text-[12.5px]">
                  {sharedBenefits.map((benefit, index) => {
                    const included = index < incluidos;
                    return (
                      <div
                        key={benefit}
                        className={
                          included
                            ? "text-uva-text"
                            : "text-uva-text-disabled opacity-45"
                        }
                      >
                        {benefit}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-[18px] text-center text-[11.5px] text-uva-text-faint opacity-45">
        Los precios se muestran en la moneda de tu país. Renovación
        automática; puedes pausar o cancelar cuando quieras.
      </p>
    </div>
  );
}
