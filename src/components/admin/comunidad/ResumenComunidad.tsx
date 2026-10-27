"use client";

import { Cifra, GraficaSemanas, Leyenda } from "@/components/admin/GraficaSemanas";
import type { ResumenComunidad as Resumen, SemanaActividad } from "@/lib/admin/comunidad-actividad";
import type { SerieGrafica } from "@/lib/admin/grafica";
import { CATEGORIA_LABEL, CATEGORIAS_COMUNIDAD } from "@/lib/comunidad-tipos";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
const enPublicaciones = (n: number) => plural(n, "publicación", "publicaciones");
const enRespuestas = (n: number) => plural(n, "respuesta", "respuestas");

/** Publicaciones abajo, respuestas encima: el tramo de abajo es el que mejor se compara entre semanas. */
const SERIES_ACTIVIDAD: SerieGrafica[] = [
  { clave: "publicaciones", nombre: "Publicaciones", color: "var(--uva-serie-1)" },
  { clave: "respuestas", nombre: "Respuestas", color: "var(--uva-serie-2)" },
];

/** Desde 2 días esperando, la cifra y la tarjeta se marcan. */
export const DIAS_ALERTA_ESPERA = 2;

function PorCategoria({ semana }: { semana: SemanaActividad }) {
  const con = CATEGORIAS_COMUNIDAD.filter((c) => semana.porCategoria[c] > 0);
  if (con.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="m-0 text-uva-etiqueta font-bold text-uva-text">Por categoría</p>
      {con.map((c) => (
        <p key={c} className="m-0 flex justify-between gap-2 text-uva-text-muted">
          <span className="truncate">{CATEGORIA_LABEL[c]}</span>
          <span className="font-mono">{semana.porCategoria[c]}</span>
        </p>
      ))}
    </div>
  );
}

/**
 * Actividad de la comunidad por semana (publicaciones abajo, respuestas
 * encima) y tres cifras: lo que espera revisión, lo que se decidió en 30
 * días y cuánta gente escribió.
 */
export function ResumenComunidad({
  resumen,
  pendientes,
  diasMasAntiguo,
}: {
  resumen: Resumen;
  /** Reportes sin revisar (no contenidos): es lo que la gente envió. */
  pendientes: number;
  diasMasAntiguo: number | null;
}) {
  const sinActividad = resumen.semanas.every((s) => s.total === 0);
  const decisiones = resumen.eliminados30 + resumen.dejados30;

  return (
    <section
      aria-labelledby="comunidad-resumen"
      className="grid rounded-uva-lg border border-uva-divider bg-uva-surface lg:grid-cols-[minmax(0,1fr)_15rem]"
    >
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:border-r lg:border-b-0 lg:px-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="comunidad-resumen" className="text-uva-cuerpo font-extrabold text-uva-text">
            Publicaciones y respuestas por semana, últimas 12 semanas
          </h2>
          {!sinActividad && <Leyenda series={SERIES_ACTIVIDAD} />}
        </div>
        <div className="relative">
          <GraficaSemanas
            semanas={resumen.semanas}
            series={SERIES_ACTIVIDAD}
            etiqueta="Publicaciones y respuestas por semana"
            resumenSemana={(semana) =>
              `${enPublicaciones(semana.porSerie.publicaciones ?? 0)} y ${enRespuestas(semana.porSerie.respuestas ?? 0)}`
            }
            extraDetalle={(semana) => <PorCategoria semana={semana} />}
            sinDatos="Nadie escribió"
          />
          {sinActividad && (
            <div className="absolute inset-x-6 top-2 bottom-8 grid place-content-center gap-1 text-center">
              <p className="m-0 font-bold text-uva-text">Nadie escribió en estas 12 semanas</p>
              <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">
                Cada publicación y respuesta aparece aquí en la semana en que se escribió.
              </p>
            </div>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-1">
        <Cifra
          valor={String(pendientes)}
          etiqueta={pendientes === 1 ? "reporte por revisar" : "reportes por revisar"}
          nota={
            diasMasAntiguo === null
              ? "Nada esperando"
              : diasMasAntiguo === 0
                ? "El más antiguo es de hoy"
                : `El más antiguo espera hace ${plural(diasMasAntiguo, "día", "días")}`
          }
          alerta={diasMasAntiguo !== null && diasMasAntiguo >= DIAS_ALERTA_ESPERA}
        />
        <Cifra
          valor={String(decisiones)}
          etiqueta="decisiones de moderación en 30 días"
          nota={
            decisiones === 0
              ? "Nada eliminado ni revisado"
              : `${plural(resumen.eliminados30, "eliminado", "eliminados")} y ${plural(resumen.dejados30, "dejado", "dejados")} en la comunidad`
          }
        />
        <Cifra
          valor={String(resumen.personas30)}
          etiqueta={resumen.personas30 === 1 ? "persona escribió en 30 días" : "personas escribieron en 30 días"}
          nota={`${enPublicaciones(resumen.publicaciones30)} y ${enRespuestas(resumen.respuestas30)}`}
          ancha
        />
      </dl>
    </section>
  );
}
