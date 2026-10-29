"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard } from "lucide-react";
import { Cifra } from "@/components/admin/GraficaSemanas";
import { ejeEnPesos } from "@/components/admin/planes/ResumenPlanes";
import { LineaSemanas } from "@/components/admin/inicio/LineaSemanas";
import { formatMoneda } from "@/lib/admin/format";
import { DIAS_AVISO_VENCE } from "@/lib/admin/planes-tipos";
import type { PagosInicio, SemanaInicio } from "@/lib/admin/dashboard";
import { cn } from "@/lib/utils";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

type Serie = "estudiaron" | "registros" | "canjes" | "certificados";

const SERIES: {
  clave: Serie;
  etiqueta: string;
  describir: (n: number) => string;
  vacio: { titulo: string; texto: string };
}[] = [
  {
    clave: "estudiaron",
    etiqueta: "Estudiaron",
    describir: (n) => plural(n, "persona estudió", "personas estudiaron"),
    vacio: {
      titulo: "Nadie ha estudiado en estas 12 semanas",
      texto: "Cuando alguien vea una clase, aquí sale cuántas personas estudian cada semana.",
    },
  },
  {
    clave: "registros",
    etiqueta: "Se registraron",
    describir: (n) => plural(n, "persona se registró", "personas se registraron"),
    vacio: {
      titulo: "Nadie se ha registrado en estas 12 semanas",
      texto: "Cada cuenta nueva aparece en la semana en que se creó.",
    },
  },
  {
    clave: "canjes",
    etiqueta: "Entraron con un código",
    describir: (n) => plural(n, "persona entró con un código", "personas entraron con un código"),
    vacio: {
      titulo: "Nadie ha usado un código en estas 12 semanas",
      texto: "Cada código canjeado aparece en la semana en que se usó.",
    },
  },
  {
    clave: "certificados",
    etiqueta: "Certificados",
    describir: (n) => plural(n, "certificado", "certificados"),
    vacio: {
      titulo: "Ningún certificado en estas 12 semanas",
      texto: "Cada certificado aparece en la semana en que se emitió.",
    },
  },
];

/**
 * Cuatro cifras de esta semana que también eligen qué se dibuja. Cada una se
 * compara con la semana pasada completa, no con un porcentaje: esta semana
 * todavía no termina y siempre saldría a la baja.
 */
export function ComoVa({ semanas }: { semanas: SemanaInicio[] }) {
  const [elegida, setElegida] = useState<Serie>("estudiaron");
  const serie = SERIES.find((s) => s.clave === elegida)!;
  const valores = semanas.map((s) => s[elegida]);
  const ultima = semanas.length - 1;

  return (
    <section aria-labelledby="inicio-como-va" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-3 sm:px-5">
        <h2 id="inicio-como-va" className="text-uva-cuerpo font-extrabold text-uva-text">
          Cómo va, semana a semana
        </h2>
        <p className="text-uva-detalle text-uva-text-muted">Cifras de esta semana; la gráfica, 12 semanas</p>
      </div>
      <div
        role="group"
        aria-label="Qué mostrar en la gráfica"
        className="grid grid-cols-2 border-y border-uva-divider lg:grid-cols-4"
      >
        {SERIES.map((s) => {
          const activa = s.clave === elegida;
          return (
            <button
              key={s.clave}
              type="button"
              aria-pressed={activa}
              onClick={() => setElegida(s.clave)}
              className="relative flex min-h-11 min-w-0 flex-col items-start gap-0.5 border-uva-divider px-4 py-3.5 text-left hover:bg-uva-hover max-lg:even:border-l max-lg:nth-[n+3]:border-t sm:px-5 lg:not-first:border-l"
            >
              <span className={cn("text-uva-detalle", activa ? "font-bold text-uva-text" : "text-uva-text-muted")}>
                {s.etiqueta}
              </span>
              <span className="font-mono text-uva-titulo-3 font-extrabold text-uva-text">{semanas[ultima][s.clave]}</span>
              <span className="text-uva-detalle text-uva-text-muted">La semana pasada, {semanas[ultima - 1][s.clave]}</span>
              {activa && <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-uva-accent" />}
            </button>
          );
        })}
      </div>
      <div className="px-4 pt-8 pb-3 sm:px-5">
        <LineaSemanas
          inicios={semanas.map((s) => s.inicio)}
          valores={valores}
          etiqueta={`${serie.etiqueta} por semana, últimas 12 semanas`}
          describir={(i) =>
            serie.describir(valores[i]) + (elegida === "estudiaron" ? `, ${semanas[i].nuevas} por primera vez` : "")
          }
          detalle={(i) =>
            elegida === "estudiaron"
              ? [
                  { texto: "Estudiaron", valor: String(semanas[i].estudiaron) },
                  {
                    texto: "Por primera vez",
                    valor: String(semanas[i].nuevas),
                  },
                  {
                    texto: "Volvieron",
                    valor: String(semanas[i].estudiaron - semanas[i].nuevas),
                  },
                ]
              : [{ texto: serie.etiqueta, valor: String(valores[i]) }]
          }
          color="stroke-uva-serie-1 fill-uva-serie-1"
          vacio={serie.vacio}
        />
      </div>
    </section>
  );
}

const enPesos = (centavos: number) => formatMoneda(centavos, "COP");

/**
 * Pagos siempre a la vista. Con el cobro apagado lo dice y lleva a Planes;
 * encendido, la plata por semana (en pesos: un Anual vale diez Mensuales) y
 * las mismas cifras de Planes y Usuarios.
 */
export function PagosInicio({ pagos }: { pagos: PagosInicio | null }) {
  if (!pagos) {
    return (
      <section
        aria-labelledby="inicio-pagos"
        className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 rounded-uva-lg border border-uva-divider bg-uva-surface px-4 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto] sm:px-5"
      >
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-uva-md bg-uva-badge-neutral-bg text-uva-badge-neutral-fg"
        >
          <CreditCard className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 id="inicio-pagos" className="text-uva-cuerpo font-extrabold text-uva-text">
            Pagos: el cobro está apagado
          </h2>
          <p className="text-uva-detalle text-uva-text-muted">
            Hoy se entra solo con un código de invitación o con acceso dado por U.V.A., así que no entra plata. Cuando se encienda
            el cobro, aquí ves lo que entra cada semana, quién paga y a quién se le acaba el plan.
          </p>
        </div>
        <Link
          href="/admin/planes"
          className="col-span-2 inline-flex min-h-11 items-center justify-center rounded-uva-md border border-uva-line-strong px-4 text-uva-detalle font-semibold text-uva-text hover:bg-uva-hover sm:col-span-1 pointer-fine:min-h-9"
        >
          Ver planes
        </Link>
      </section>
    );
  }

  const valores = pagos.semanas.map((s) => s.total);
  const noAprobados = Math.max(0, pagos.intentos30 - pagos.ventas30);
  return (
    <section aria-labelledby="inicio-pagos" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
      <div className="px-4 pt-4 pb-3 sm:px-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="inicio-pagos" className="text-uva-cuerpo font-extrabold text-uva-text">
            Pagos
          </h2>
          <Link href="/admin/planes" className="text-uva-detalle font-semibold text-uva-accent-text hover:underline">
            Ver planes
          </Link>
        </div>
        <p className="mb-7 text-uva-detalle text-uva-text-muted">
          Plata que entró por semana, en pesos, con los pagos aprobados.
        </p>
        <LineaSemanas
          inicios={pagos.semanas.map((s) => s.inicio)}
          valores={valores}
          etiqueta="Plata que entró por semana, últimas 12 semanas"
          describir={(i) => `${enPesos(valores[i])} en ${plural(pagos.semanas[i].ventas, "venta", "ventas")}`}
          detalle={(i) => [
            { texto: "Entró", valor: enPesos(valores[i]) },
            { texto: "Ventas", valor: String(pagos.semanas[i].ventas) },
          ]}
          formato={enPesos}
          formatoEje={ejeEnPesos}
          color="stroke-uva-serie-3 fill-uva-serie-3"
          vacio={{
            titulo: "Ninguna venta en pesos en estas 12 semanas",
            texto: "Cada pago aprobado aparece en la semana en que se aprobó.",
          }}
        />
      </div>
      <dl className="grid grid-cols-2 border-t border-uva-divider lg:grid-cols-3">
        <Cifra
          enFila
          valor={enPesos(pagos.recaudadoCop)}
          etiqueta="entraron en 30 días"
          nota={
            pagos.intentos30 === 0
              ? "Nadie intentó pagar"
              : `${plural(pagos.ventas30, "venta", "ventas")}; ${plural(noAprobados, "pago no se aprobó", "pagos no se aprobaron")}`
          }
          pequena
        />
        <Cifra
          enFila
          valor={String(pagos.vigentes)}
          etiqueta={pagos.vigentes === 1 ? "plan pagado vigente" : "planes pagados vigentes"}
          nota={
            pagos.vencen > 0
              ? `${pagos.vencen} ${pagos.vencen === 1 ? "se acaba" : "se acaban"} en ${DIAS_AVISO_VENCE} días`
              : `Ninguno se acaba en ${DIAS_AVISO_VENCE} días`
          }
          alerta={pagos.vencen > 0}
          pequena
        />
        <Cifra
          enFila
          ancha
          valor={pagos.invitacionTerminada > 0 ? `${pagos.pagaronDespues} de ${pagos.invitacionTerminada}` : "Nadie"}
          etiqueta="compraron al acabarse la invitación"
          nota={
            pagos.invitacionTerminada > 0
              ? `${Math.round((pagos.pagaronDespues / pagos.invitacionTerminada) * 100)} % de a quienes se les acabó`
              : "A nadie se le ha acabado todavía"
          }
          pequena
        />
      </dl>
    </section>
  );
}
