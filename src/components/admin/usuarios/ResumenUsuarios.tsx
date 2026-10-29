"use client";

import { Cifra, GraficaSemanas } from "@/components/admin/GraficaSemanas";
import type { ResumenUsuarios as Resumen, SemanaEstudio } from "@/lib/admin/usuarios-estudio";
import type { SerieGrafica } from "@/lib/admin/grafica";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Un solo color: la barra es cuánta gente estudió; los repartos van en el detalle. */
const SERIES: SerieGrafica[] = [{ clave: "personas", nombre: "Estudiaron", color: "var(--uva-serie-1)" }];

function Fila({ texto, valor }: { texto: string; valor: number }) {
  return (
    <p className="m-0 flex justify-between gap-2 text-uva-text-muted">
      <span>{texto}</span>
      <span className="font-mono">{valor}</span>
    </p>
  );
}

/** Dos formas de partir a las mismas personas: cada una con su línea y su subtítulo. */
function Repartos({ semana, conCobro }: { semana: SemanaEstudio; conCobro: boolean }) {
  return (
    <>
      {conCobro && (
        <div className="mt-2 border-t border-uva-divider pt-2">
          <p className="m-0 mb-0.5 text-uva-etiqueta font-bold text-uva-muted-2">Cómo tienen acceso</p>
          <Fila texto="Con plan pagado" valor={semana.pagan} />
          <Fila texto="Gratis (código o dado por U.V.A.)" valor={semana.total - semana.pagan} />
        </div>
      )}
      <div className="mt-2 border-t border-uva-divider pt-2">
        <p className="m-0 mb-0.5 text-uva-etiqueta font-bold text-uva-muted-2">Si son nuevas</p>
        <Fila texto="Su primera semana estudiando" valor={semana.nuevas} />
        <Fila texto="Ya habían estudiado antes" valor={semana.volvieron} />
      </div>
    </>
  );
}

const enlace = (filtros: string, texto = "Ver quiénes") => ({ href: `/admin/usuarios?${filtros}`, texto });

/** Personas que estudiaron cada semana y cuatro cifras que llevan a esas personas. */
export function ResumenUsuarios({ resumen }: { resumen: Resumen }) {
  const r = resumen;
  const sinDatos = r.semanas.every((s) => s.total === 0);
  const gratis = Math.max(0, r.conAcceso - r.paganHoy - r.pagoPendiente);

  const estudiaron = (
    <Cifra
      enFila
      valor={String(r.estudiaronSemana)}
      etiqueta={r.estudiaronSemana === 1 ? "estudió en los últimos 7 días" : "estudiaron en los últimos 7 días"}
      nota={`De ${plural(r.conAcceso, "persona", "personas")} con acceso hoy`}
      enlace={r.estudiaronSemana > 0 ? enlace("estudio=SEMANA") : undefined}
    />
  );
  const parados = (
    <Cifra
      enFila
      valor={String(r.parados)}
      etiqueta={r.parados === 1 ? "lleva 14 días sin estudiar" : "llevan 14 días sin estudiar"}
      nota={
        r.parados === 0
          ? "Todos los que tienen acceso estudiaron hace poco"
          : r.conCobro
            ? `Tienen acceso y no han vuelto; ${r.paradosPagan} de ellos pagan`
            : "Tienen acceso y no han vuelto"
      }
      alerta={r.parados > 0}
      enlace={r.parados > 0 ? enlace("estudio=PARADOS") : undefined}
    />
  );

  return (
    <section aria-labelledby="usuarios-resumen" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:px-6">
        <h2 id="usuarios-resumen" className="mb-3 text-uva-cuerpo font-extrabold text-uva-text">
          Personas que estudiaron cada semana
        </h2>
        <div className="relative">
          <GraficaSemanas
            semanas={r.semanas}
            series={SERIES}
            etiqueta="Personas que estudiaron por semana, últimas 12 semanas"
            resumenSemana={(semana) =>
              `${plural(semana.total, "persona estudió", "personas estudiaron")}.` +
              (r.conCobro ? ` Cómo tienen acceso: ${semana.pagan} con plan pagado y ${semana.total - semana.pagan} gratis.` : "") +
              ` Si son nuevas: ${semana.nuevas} en su primera semana estudiando y ${semana.volvieron} ya habían estudiado antes.`
            }
            extraDetalle={(semana) => <Repartos semana={semana} conCobro={r.conCobro} />}
            sinDatos="Nadie estudió"
          />
          {sinDatos && (
            <div className="absolute inset-x-6 top-2 bottom-8 grid place-content-center gap-1 text-center">
              <p className="m-0 font-bold text-uva-text">Nadie vio una clase en estas 12 semanas</p>
              <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">
                Cada semana cuenta a quien vio al menos una clase, una sola vez.
              </p>
            </div>
          )}
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        {r.conCobro ? (
          <>
            {estudiaron}
            <Cifra
              enFila
              valor={String(r.paganHoy)}
              etiqueta={r.paganHoy === 1 ? "paga hoy" : "pagan hoy"}
              nota={
                r.pagoPendiente > 0
                  ? `${r.pagoPendiente} con el pago pendiente; ${gratis} entran gratis`
                  : `Y ${gratis} entran gratis`
              }
              alerta={r.pagoPendiente > 0}
              enlace={r.paganHoy > 0 ? enlace("origen=PAGO&suscripcion=ACTIVA") : undefined}
            />
            <Cifra
              enFila
              valor={r.invitacionTerminada > 0 ? `${Math.round((r.pagaronDespues / r.invitacionTerminada) * 100)} %` : "Nadie"}
              etiqueta="pasaron de invitación a pago"
              nota={
                r.invitacionTerminada > 0
                  ? `${r.pagaronDespues} de ${plural(r.invitacionTerminada, "persona", "personas")} a quienes se les acabó la invitación compraron un plan`
                  : "Todavía no se le ha acabado la invitación a nadie"
              }
              pequena={r.invitacionTerminada === 0}
            />
            {parados}
          </>
        ) : (
          <>
            {estudiaron}
            {parados}
            <Cifra
              enFila
              valor={String(r.sinAcceso)}
              etiqueta={r.sinAcceso === 1 ? "nunca tuvo acceso" : "nunca tuvieron acceso"}
              nota="Crearon la cuenta y no canjearon un código"
              enlace={r.sinAcceso > 0 ? enlace("suscripcion=SIN_SUSCRIPCION") : undefined}
            />
            <Cifra
              enFila
              valor={String(r.vencidos)}
              etiqueta={r.vencidos === 1 ? "se le acabó el acceso" : "se les acabó el acceso"}
              nota="Tuvieron acceso y ya no lo tienen"
              enlace={r.vencidos > 0 ? enlace("suscripcion=VENCIDA") : undefined}
            />
          </>
        )}
      </dl>
    </section>
  );
}
