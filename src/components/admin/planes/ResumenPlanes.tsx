"use client";

import { Cifra, GraficaSemanas, Leyenda } from "@/components/admin/GraficaSemanas";
import { formatMoneda } from "@/lib/admin/format";
import { DIAS_AVISO_VENCE } from "@/lib/admin/planes-tipos";
import type { VentasPlanes } from "@/lib/admin/planes-ventas";

/** El eje en pesos, corto: "$6 M", "$500 mil". */
function ejeEnPesos(centavos: number) {
  const pesos = centavos / 100;
  const corto = (valor: number) => valor.toLocaleString("es-CO", { maximumFractionDigits: 1 });
  if (pesos >= 1_000_000) return `$${corto(pesos / 1_000_000)} M`;
  if (pesos >= 1_000) return `$${corto(pesos / 1_000)} mil`;
  return `$${corto(pesos)}`;
}

const enVentas = (n: number) => `${n} ${n === 1 ? "venta" : "ventas"}`;
const enPesos = (centavos: number) => formatMoneda(centavos, "COP");

/**
 * Lo recaudado por semana, apilado por plan, y tres cifras al lado. `ventas`
 * es null mientras el cobro está apagado: entonces la gráfica dice por qué
 * está vacía en vez de dibujar barras en cero.
 */
export function ResumenPlanes({ ventas }: { ventas: VentasPlanes | null }) {
  const sinVentas = !ventas || ventas.semanas.every((s) => s.total === 0);
  const porcentaje = ventas && ventas.intentos30 > 0 ? Math.round((ventas.ventas30 / ventas.intentos30) * 100) : null;

  return (
    <section
      aria-labelledby="planes-resumen"
      className="grid rounded-uva-lg border border-uva-divider bg-uva-surface lg:grid-cols-[minmax(0,1fr)_15rem]"
    >
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:border-r lg:border-b-0 lg:px-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="planes-resumen" className="text-uva-cuerpo font-extrabold text-uva-text">
            Recaudado por semana, últimas 12 semanas
          </h2>
          {ventas && !sinVentas && <Leyenda series={ventas.series} />}
        </div>
        <div className="relative">
          <GraficaSemanas
            semanas={ventas?.semanas ?? null}
            series={ventas?.series ?? []}
            etiqueta="Recaudado por semana, por plan"
            formato={enPesos}
            formatoEje={ejeEnPesos}
            resumenSemana={(semana) => `${enPesos(semana.total)} en ${enVentas(semana.ventas)}`}
            notaDetalle={(semana, clave) => `, ${enVentas(clave === null ? semana.ventas : (semana.ventasPorSerie[clave] ?? 0))}`}
            sinDatos="Sin ventas"
          />
          {sinVentas && (
            <div className="absolute inset-x-6 top-2 bottom-8 grid place-content-center gap-1 text-center">
              <p className="font-bold text-uva-text">
                {ventas ? "Ninguna venta en pesos en estas 12 semanas" : "Sin ventas todavía"}
              </p>
              <p className="max-w-[42ch] text-uva-detalle text-uva-text-muted">
                {ventas
                  ? "Cada pago aprobado aparece aquí en la semana en que se aprobó."
                  : "Aquí verás cuánto deja cada plan por semana cuando se encienda el cobro."}
              </p>
            </div>
          )}
        </div>
        {ventas && ventas.fueraDeGrafica > 0 && (
          <p className="mt-2 text-uva-detalle text-uva-text-muted">
            No incluye {enVentas(ventas.fueraDeGrafica)} en otras monedas: la gráfica va en pesos.
          </p>
        )}
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-1">
        <Cifra
          valor={ventas ? String(ventas.vigentes) : "Ninguna"}
          etiqueta="membresías pagadas vigentes"
          nota={
            !ventas
              ? "El cobro está apagado"
              : ventas.vencen > 0
                ? `${ventas.vencen} ${ventas.vencen === 1 ? "vence" : "vencen"} en los próximos ${DIAS_AVISO_VENCE} días`
                : `Ninguna vence en los próximos ${DIAS_AVISO_VENCE} días`
          }
          alerta={!!ventas && ventas.vencen > 0}
          pequena={!ventas}
        />
        <Cifra
          valor={ventas ? String(ventas.ventas30) : "Ninguna"}
          etiqueta="ventas en 30 días"
          nota={
            !ventas
              ? "El cobro está apagado"
              : porcentaje !== null
                ? `${porcentaje} % de ${ventas.intentos30 === 1 ? "1 intento" : `los ${ventas.intentos30} intentos`} de pago`
                : "Nadie intentó pagar"
          }
          pequena={!ventas}
        />
        <Cifra
          valor={enPesos(ventas?.recaudadoCop ?? 0)}
          etiqueta="recaudado en 30 días"
          nota={ventas ? "En pesos, ya con los descuentos de cupones" : "El cobro está apagado"}
          pequena
          ancha
        />
      </dl>
    </section>
  );
}
