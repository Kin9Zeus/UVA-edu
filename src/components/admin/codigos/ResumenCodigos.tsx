"use client";

import { Cifra, GraficaSemanas } from "@/components/admin/GraficaSemanas";
import type { ResumenCodigos as Resumen, SemanaCanjes } from "@/lib/admin/codigos-uso";
import type { SerieGrafica } from "@/lib/admin/grafica";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Un solo color: la barra es cuánta gente entró; el reparto va en el detalle. */
const SERIES_CANJES: SerieGrafica[] = [{ clave: "canjes", nombre: "Canjes", color: "var(--uva-serie-1)" }];

function Reparto({ semana }: { semana: SemanaCanjes }) {
  return (
    <div className="mt-1 border-t border-uva-divider pt-1">
      <p className="m-0 flex justify-between gap-2 text-uva-text-muted">
        <span>Códigos compartidos</span>
        <span className="font-mono">{semana.compartidos}</span>
      </p>
      <p className="m-0 flex justify-between gap-2 text-uva-text-muted">
        <span>Códigos de lote</span>
        <span className="font-mono">{semana.deLote}</span>
      </p>
    </div>
  );
}

function ultimoCanje(dias: number | null) {
  if (dias === null) return "Nadie ha canjeado todavía";
  if (dias === 0) return "El último fue hoy";
  if (dias === 1) return "El último fue ayer";
  return `El último fue hace ${dias} días`;
}

/**
 * Canjes por semana y cuatro cifras debajo, en fila: con cuatro, una columna
 * al costado quedaba más alta que la gráfica.
 */
export function ResumenCodigos({
  resumen,
  cupos,
  cuposPorVencer,
}: {
  resumen: Resumen;
  /** Personas que todavía pueden entrar con los códigos activos. */
  cupos: number;
  cuposPorVencer: number;
}) {
  const sinCanjes = resumen.semanas.every((s) => s.total === 0);
  const { empezaron30, personas30 } = resumen;

  return (
    <section aria-labelledby="codigos-resumen" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:px-6">
        <h2 id="codigos-resumen" className="mb-3 text-uva-cuerpo font-extrabold text-uva-text">
          Canjes por semana, últimas 12 semanas
        </h2>
        <div className="relative">
          <GraficaSemanas
            semanas={resumen.semanas}
            series={SERIES_CANJES}
            etiqueta="Canjes por semana"
            resumenSemana={(semana) =>
              `${plural(semana.total, "canje", "canjes")}: ${semana.compartidos} de códigos compartidos y ${semana.deLote} de lote`
            }
            extraDetalle={(semana) => <Reparto semana={semana} />}
            sinDatos="Sin canjes"
          />
          {sinCanjes && (
            <div className="absolute inset-x-6 top-2 bottom-8 grid place-content-center gap-1 text-center">
              <p className="m-0 font-bold text-uva-text">Nadie canjeó un código en estas 12 semanas</p>
              <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">
                Cada canje aparece aquí en la semana en que la persona entró.
              </p>
            </div>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        <Cifra
          enFila
          valor={String(cupos)}
          etiqueta={cupos === 1 ? "cupo por canjear" : "cupos por canjear"}
          nota={
            cuposPorVencer > 0
              ? `${plural(cuposPorVencer, "vence", "vencen")} en los próximos 7 días`
              : "Ninguno vence en los próximos 7 días"
          }
          alerta={cuposPorVencer > 0}
        />
        <Cifra
          enFila
          valor={String(resumen.canjes30)}
          etiqueta={resumen.canjes30 === 1 ? "canje en 30 días" : "canjes en 30 días"}
          nota={ultimoCanje(resumen.diasUltimoCanje)}
        />
        <Cifra
          enFila
          valor={personas30 > 0 ? `${Math.round((empezaron30 / personas30) * 100)} %` : "Nadie"}
          etiqueta="empezaron a estudiar"
          nota={personas30 > 0 ? `${empezaron30} de ${plural(personas30, "persona que entró", "personas que entraron")} en 30 días` : "Nadie entró en 30 días"}
          pequena={personas30 === 0}
        />
        <Cifra
          enFila
          valor={String(resumen.conInvitacion)}
          etiqueta={resumen.conInvitacion === 1 ? "persona entra hoy con invitación" : "personas entran hoy con invitación"}
          nota={
            resumen.seLesAcaba > 0
              ? `A ${resumen.seLesAcaba} se le${resumen.seLesAcaba === 1 ? "" : "s"} acaba en los próximos 7 días`
              : "A nadie se le acaba en los próximos 7 días"
          }
          alerta={resumen.seLesAcaba > 0}
        />
      </dl>
    </section>
  );
}
