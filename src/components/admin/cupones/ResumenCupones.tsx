"use client";

import { Cifra, GraficaSemanas, Leyenda } from "@/components/admin/GraficaSemanas";
import { formatMoneda } from "@/lib/admin/format";
import type { UsoCupones } from "@/lib/admin/cupones-uso";

/**
 * Usos de los cupones por semana, apilados por cupón, y tres cifras al lado.
 * `uso` es null mientras el cobro está apagado: entonces la gráfica dice por
 * qué está vacía en vez de dibujar barras en cero.
 */
export function ResumenCupones({
  uso,
  activos,
  vencenEstaSemana,
}: {
  uso: UsoCupones | null;
  activos: number;
  vencenEstaSemana: number;
}) {
  const sinUsos = !uso || uso.semanas.every((s) => s.total === 0);
  const porcentaje = uso && uso.pagosTotales > 0 ? Math.round((uso.pagosConCupon / uso.pagosTotales) * 100) : null;

  return (
    <section
      aria-labelledby="cupones-resumen"
      className="grid rounded-uva-lg border border-uva-divider bg-uva-surface lg:grid-cols-[minmax(0,1fr)_15rem]"
    >
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:border-r lg:border-b-0 lg:px-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="cupones-resumen" className="text-uva-cuerpo font-extrabold text-uva-text">
            Usos por semana, últimas 12 semanas
          </h2>
          {uso && !sinUsos && <Leyenda series={uso.series} nombresEnCodigo />}
        </div>
        <div className="relative">
          <GraficaSemanas
            semanas={uso?.semanas ?? null}
            series={uso?.series ?? []}
            etiqueta="Usos de cupones por semana"
            resumenSemana={(semana) => `${semana.total} ${semana.total === 1 ? "uso" : "usos"}`}
            sinDatos="Sin usos"
            nombresEnCodigo
          />
          {sinUsos && (
            <div className="absolute inset-x-6 top-2 bottom-8 grid place-content-center gap-1 text-center">
              <p className="font-bold text-uva-text">
                {uso ? "Ningún cupón se usó en estas 12 semanas" : "Sin usos todavía"}
              </p>
              <p className="max-w-[42ch] text-uva-detalle text-uva-text-muted">
                {uso
                  ? "Cada pago aprobado con cupón aparece aquí en la semana en que se aprobó."
                  : "Aquí verás cuántas veces se usa cada cupón cuando se encienda el cobro."}
              </p>
            </div>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-1">
        <Cifra
          valor={String(activos)}
          etiqueta={activos === 1 ? "cupón activo" : "cupones activos"}
          nota={
            vencenEstaSemana > 0
              ? `${vencenEstaSemana} ${vencenEstaSemana === 1 ? "vence" : "vencen"} en los próximos 7 días`
              : "Ninguno vence en los próximos 7 días"
          }
          alerta={vencenEstaSemana > 0}
        />
        <Cifra
          valor={uso ? String(uso.pagosConCupon) : "Ninguno"}
          etiqueta="pagos con cupón, 30 días"
          nota={!uso ? "El cobro está apagado" : porcentaje !== null ? `${porcentaje} % de los ${uso.pagosTotales} pagos` : "Todavía no hay pagos"}
          pequena={!uso}
        />
        <Cifra
          valor={formatMoneda(uso?.recaudadoCop ?? 0, "COP")}
          etiqueta="recaudado en 30 días"
          nota={uso ? "Con cupón y en pesos, ya con el descuento" : "El cobro está apagado"}
          pequena
          ancha
        />
      </dl>
    </section>
  );
}
