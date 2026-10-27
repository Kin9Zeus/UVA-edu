"use client";

import { useEffect, useRef, useState } from "react";
import { caminoSegmento } from "@/lib/admin/grafica";
import { formatMoneda } from "@/lib/admin/format";
import type { SemanaCupones, SerieCupon, UsoCupones } from "@/lib/admin/cupones-uso";
import { cn } from "@/lib/utils";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function corto(dia: string) {
  const [, mes, d] = dia.split("-").map(Number);
  return `${d} ${MESES[mes - 1]}`;
}

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
          {uso && !sinUsos && <Leyenda series={uso.series} />}
        </div>
        <div className="relative">
          <Grafica semanas={uso?.semanas ?? null} series={uso?.series ?? []} />
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

function Cifra({
  valor,
  etiqueta,
  nota,
  alerta,
  pequena,
  ancha,
}: {
  valor: string;
  etiqueta: string;
  nota: string;
  alerta?: boolean;
  pequena?: boolean;
  /** En celular ocupa la fila entera: un monto en pesos no cabe en media. */
  ancha?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 border-uva-divider px-4 py-4 max-[359px]:px-3 sm:px-5 max-lg:even:border-l lg:border-t lg:first:border-t-0",
        ancha && "max-lg:col-span-2 max-lg:border-t",
      )}
    >
      <dt className="order-2 text-uva-detalle text-uva-text-muted">{etiqueta}</dt>
      <dd className={cn("order-1 font-mono font-extrabold break-words text-uva-text", pequena ? "text-uva-titulo-4" : "text-uva-titulo-3")}>
        {valor}
      </dd>
      <dd className={cn("order-3 text-uva-detalle", alerta ? "font-bold text-uva-warning-text" : "text-uva-text-muted")}>{nota}</dd>
    </div>
  );
}

function Leyenda({ series }: { series: SerieCupon[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-uva-detalle text-uva-text-muted" aria-label="Leyenda">
      {series.map((serie) => (
        <li key={serie.clave} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-uva-xs" style={{ background: serie.color }} />
          <span className={serie.clave === "otros" ? undefined : "font-codigo text-uva-etiqueta"}>{serie.nombre}</span>
        </li>
      ))}
    </ul>
  );
}

function etiquetaSemana(semana: SemanaCupones, esActual: boolean) {
  const nombre = esActual ? "Esta semana" : `Semana del ${corto(semana.inicio)}`;
  return `${nombre}: ${semana.total === 0 ? "sin usos" : `${semana.total} ${semana.total === 1 ? "uso" : "usos"}`}`;
}

function Grafica({ semanas, series }: { semanas: SemanaCupones[] | null; series: SerieCupon[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [activa, setActiva] = useState<number | null>(null);

  // Igual que la gráfica de la bitácora: se dibuja al ancho real, y el
  // viewBox hace que lo pintado en el servidor quepa antes de medir.
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.max(240, Math.round(entrada.contentRect.width))));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const angosta = ancho < 480;
  const alto = angosta ? 130 : 230;
  const arriba = 14, abajo = 24;
  const hayDatos = semanas !== null && semanas.some((s) => s.total > 0);
  const izquierda = hayDatos ? 24 : 0;
  const cantidad = semanas?.length ?? 12;
  const maximo = hayDatos ? Math.max(...semanas.map((s) => s.total)) : 4;
  const tope = Math.max(4, Math.ceil(maximo / 4) * 4);
  const paso = (ancho - izquierda) / cantidad;
  const grosor = Math.min(angosta ? 16 : 34, paso - (angosta ? 6 : 14));
  const escala = (valor: number) => ((alto - arriba - abajo) * valor) / tope;
  const base = alto - abajo;
  const ultima = cantidad - 1;
  const marcas = angosta ? [0, ultima] : [0, 3, 6, 9, ultima];

  return (
    <div ref={contenedor} className="relative">
      <svg
        width="100%"
        height={alto}
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        role="group"
        aria-label="Usos de cupones por semana"
        className="block overflow-visible"
      >
        {hayDatos && [tope / 2, tope].map((valor) => {
          const y = base - escala(valor);
          return (
            <g key={valor} aria-hidden>
              <line x1={izquierda} x2={ancho} y1={y} y2={y} className="stroke-uva-divider" strokeDasharray="2 4" />
              <text x={0} y={y + 4} className="fill-uva-text-faint text-uva-etiqueta">{valor}</text>
            </g>
          );
        })}
        <line x1={izquierda} x2={ancho} y1={base} y2={base} className="stroke-uva-divider" aria-hidden />
        {hayDatos &&
          semanas.map((semana, i) => {
            const x = izquierda + i * paso + (paso - grosor) / 2;
            const presentes = series.filter((s) => semana.porSerie[s.clave]);
            let y = base;
            return (
              <g key={semana.inicio}>
                <rect
                  x={izquierda + i * paso}
                  y={arriba - 10}
                  width={paso}
                  height={base - arriba + 10}
                  rx={4}
                  tabIndex={0}
                  role="img"
                  aria-label={etiquetaSemana(semana, i === ultima)}
                  className="fill-transparent outline-none hover:fill-uva-hover focus-visible:fill-uva-accent-soft"
                  onMouseEnter={() => setActiva(i)}
                  onMouseLeave={() => setActiva(null)}
                  onFocus={() => setActiva(i)}
                  onBlur={() => setActiva(null)}
                />
                {presentes.map((serie, j) => {
                  const altoSerie = escala(semana.porSerie[serie.clave] ?? 0);
                  // 2 px de separación entre segmentos.
                  const visible = Math.max(1, altoSerie - (j < presentes.length - 1 ? 2 : 0));
                  const camino = caminoSegmento(x, y, grosor, visible, j === presentes.length - 1);
                  y -= altoSerie;
                  return <path key={serie.clave} d={camino} fill={serie.color} className="pointer-events-none" aria-hidden />;
                })}
              </g>
            );
          })}
        {semanas &&
          marcas.map((i) => (
            <text
              key={i}
              aria-hidden
              x={i === 0 ? izquierda : i === ultima ? ancho : izquierda + i * paso + paso / 2}
              y={alto - 6}
              textAnchor={i === 0 ? "start" : i === ultima ? "end" : "middle"}
              className="fill-uva-text-faint text-uva-etiqueta"
            >
              {i === ultima ? "esta semana" : corto(semanas[i].inicio)}
            </text>
          ))}
      </svg>
      {hayDatos && activa !== null && (
        <Tooltip semana={semanas[activa]} series={series} esActual={activa === ultima} x={izquierda + activa * paso + paso / 2} ancho={ancho} />
      )}
    </div>
  );
}

function Tooltip({ semana, series, esActual, x, ancho }: { semana: SemanaCupones; series: SerieCupon[]; esActual: boolean; x: number; ancho: number }) {
  const anchoTip = 208;
  const izquierda = Math.max(0, Math.min(x - anchoTip / 2, ancho - anchoTip));
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-uva-md border border-uva-divider bg-uva-surface px-3 py-2.5 text-uva-detalle shadow-uva-menu"
      style={{ left: izquierda, width: anchoTip }}
    >
      <p className="mb-1 font-bold text-uva-text">{esActual ? "Esta semana" : `Semana del ${corto(semana.inicio)}`}</p>
      {semana.total === 0 && <p className="text-uva-text-muted">Sin usos</p>}
      {series
        .filter((s) => semana.porSerie[s.clave])
        .map((serie) => (
          <p key={serie.clave} className="flex items-center justify-between gap-2 text-uva-text-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-uva-xs" style={{ background: serie.color }} />
              <span className={cn("truncate", serie.clave !== "otros" && "font-codigo text-uva-etiqueta")}>{serie.nombre}</span>
            </span>
            <span className="font-mono">{semana.porSerie[serie.clave]}</span>
          </p>
        ))}
      {semana.total > 0 && (
        <p className="mt-1 flex justify-between gap-2 border-t border-uva-divider pt-1 font-bold text-uva-text">
          <span>Total</span>
          <span className="font-mono">{semana.total}</span>
        </p>
      )}
    </div>
  );
}
