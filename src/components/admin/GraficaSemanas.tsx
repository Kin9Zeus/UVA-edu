"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { caminoSegmento, type SemanaGrafica, type SerieGrafica } from "@/lib/admin/grafica";
import { cn } from "@/lib/utils";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export function corto(dia: string) {
  const [, mes, d] = dia.split("-").map(Number);
  return `${d} ${MESES[mes - 1]}`;
}

/** 1, 2, 4, 6, 8 o 10 por una potencia de diez: así la guía de la mitad cae en un número redondo. */
export function topeDe(maximo: number) {
  if (maximo <= 4) return 4;
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  return [1, 2, 4, 6, 8, 10].map((m) => m * magnitud).find((tope) => tope >= maximo)!;
}

function nombreSemana(semana: SemanaGrafica, esActual: boolean) {
  return esActual ? "Esta semana" : `Semana del ${corto(semana.inicio)}`;
}

/**
 * Barras por semana, apiladas por serie, con el detalle de cada semana al
 * pasar el mouse o el foco. La comparten Cupones (usos), Planes (plata) y
 * Comunidad (publicaciones y respuestas), Códigos (canjes) y Usuarios (quién
 * estudió y cuántos días estudió cada persona).
 * Con `semanas` en null dibuja solo la base: quien la usa pone encima el
 * texto que explica por qué está vacía.
 */
export function GraficaSemanas<S extends SemanaGrafica>({
  semanas,
  series,
  etiqueta,
  formato = String,
  formatoEje = formato,
  resumenSemana,
  notaDetalle,
  extraDetalle,
  sinDatos,
  nombresEnCodigo,
}: {
  semanas: S[] | null;
  series: SerieGrafica[];
  etiqueta: string;
  /** Cómo se escribe un valor en el detalle. */
  formato?: (valor: number) => string;
  formatoEje?: (valor: number) => string;
  /** Para el lector de pantalla, sin el nombre de la semana: "3 usos". */
  resumenSemana: (semana: S) => string;
  /** Lo que sigue al nombre en el detalle (", 8 ventas"); `null` es la fila Total. */
  notaDetalle?: (semana: S, clave: string | null) => string;
  /** Lo que va debajo del Total: el reparto por categoría de Comunidad. */
  extraDetalle?: (semana: S) => ReactNode;
  /** "Sin usos", "Sin ventas". */
  sinDatos: string;
  nombresEnCodigo?: boolean;
}) {
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
  const tope = hayDatos ? topeDe(Math.max(...semanas.map((s) => s.total))) : 4;
  // El ancho de la etiqueta más larga del eje ("$6 M"), a ojo: 7 px por letra.
  const izquierda = hayDatos ? Math.max(24, formatoEje(tope).length * 7 + 6) : 0;
  const cantidad = semanas?.length ?? 12;
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
        aria-label={etiqueta}
        className="block overflow-visible"
      >
        {hayDatos && [tope / 2, tope].map((valor) => {
          const y = base - escala(valor);
          return (
            <g key={valor} aria-hidden>
              <line x1={izquierda} x2={ancho} y1={y} y2={y} className="stroke-uva-divider" strokeDasharray="2 4" />
              <text x={0} y={y + 4} className="fill-uva-text-faint text-uva-etiqueta">{formatoEje(valor)}</text>
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
                  aria-label={`${nombreSemana(semana, i === ultima)}: ${semana.total === 0 ? sinDatos.toLowerCase() : resumenSemana(semana)}`}
                  className="fill-transparent outline-none hover:fill-uva-hover focus-visible:fill-uva-accent-soft focus-visible:stroke-uva-accent focus-visible:stroke-2"
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
        <Detalle
          semana={semanas[activa]}
          series={series}
          esActual={activa === ultima}
          x={izquierda + activa * paso + paso / 2}
          ancho={ancho}
          formato={formato}
          nota={notaDetalle}
          extra={extraDetalle}
          sinDatos={sinDatos}
          nombresEnCodigo={nombresEnCodigo}
        />
      )}
    </div>
  );
}

function Detalle<S extends SemanaGrafica>({
  semana,
  series,
  esActual,
  x,
  ancho,
  formato,
  nota,
  extra,
  sinDatos,
  nombresEnCodigo,
}: {
  semana: S;
  series: SerieGrafica[];
  esActual: boolean;
  x: number;
  ancho: number;
  formato: (valor: number) => string;
  nota?: (semana: S, clave: string | null) => string;
  extra?: (semana: S) => ReactNode;
  sinDatos: string;
  nombresEnCodigo?: boolean;
}) {
  const anchoTip = nota || extra ? 256 : 208;
  const izquierda = Math.max(0, Math.min(x - anchoTip / 2, ancho - anchoTip));
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-uva-md border border-uva-divider bg-uva-surface px-3 py-2.5 text-uva-detalle shadow-uva-menu"
      style={{ left: izquierda, width: anchoTip }}
    >
      <p className="mb-1 font-bold text-uva-text">{nombreSemana(semana, esActual)}</p>
      {semana.total === 0 && <p className="text-uva-text-muted">{sinDatos}</p>}
      {series
        .filter((s) => semana.porSerie[s.clave])
        .map((serie) => (
          <p key={serie.clave} className="flex items-center justify-between gap-2 text-uva-text-muted">
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <span className="size-2.5 shrink-0 rounded-uva-xs" style={{ background: serie.color }} />
              <span className="truncate">
                <span className={cn(nombresEnCodigo && serie.clave !== "otros" && "font-codigo text-uva-etiqueta")}>{serie.nombre}</span>
                {nota?.(semana, serie.clave)}
              </span>
            </span>
            <span className="font-mono">{formato(semana.porSerie[serie.clave])}</span>
          </p>
        ))}
      {/* Con una sola serie, el Total repetiría la fila de arriba. */}
      {semana.total > 0 && series.length > 1 && (
        <p className="mt-1 flex justify-between gap-2 border-t border-uva-divider pt-1 font-bold text-uva-text">
          <span>Total{nota?.(semana, null)}</span>
          <span className="font-mono">{formato(semana.total)}</span>
        </p>
      )}
      {semana.total > 0 && extra?.(semana)}
    </div>
  );
}

export function Leyenda({ series, nombresEnCodigo }: { series: SerieGrafica[]; nombresEnCodigo?: boolean }) {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-uva-detalle text-uva-text-muted" aria-label="Leyenda">
      {series.map((serie) => (
        <li key={serie.clave} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-uva-xs" style={{ background: serie.color }} />
          <span className={nombresEnCodigo && serie.clave !== "otros" ? "font-codigo text-uva-etiqueta" : undefined}>{serie.nombre}</span>
        </li>
      ))}
    </ul>
  );
}

/** Una cifra del costado de un resumen: valor grande, qué es y una nota. */
export function Cifra({
  valor,
  etiqueta,
  nota,
  alerta,
  pequena,
  ancha,
  enFila,
  enlace,
}: {
  valor: string;
  etiqueta: string;
  nota: string;
  alerta?: boolean;
  pequena?: boolean;
  /** En celular ocupa la fila entera: un monto en pesos no cabe en media. */
  ancha?: boolean;
  /** Cuatro cifras debajo de la gráfica: en fila en computador, de dos en dos en celular. */
  enFila?: boolean;
  /** Lleva a la lista de esas personas (Usuarios filtra la tabla). */
  enlace?: { href: string; texto: string };
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-0.5 border-uva-divider px-4 py-4 max-[359px]:px-3 sm:px-5 max-lg:even:border-l",
        enFila ? "max-lg:nth-[n+3]:border-t lg:not-first:border-l" : "lg:border-t lg:first:border-t-0",
        ancha && "max-lg:col-span-2 max-lg:border-t",
      )}
    >
      <dt className="order-2 text-uva-detalle text-uva-text-muted">{etiqueta}</dt>
      <dd className={cn("order-1 font-mono font-extrabold break-words text-uva-text", pequena ? "text-uva-titulo-4" : "text-uva-titulo-3")}>
        {valor}
      </dd>
      <dd className={cn("order-3 text-uva-detalle", alerta ? "font-bold text-uva-warning-text" : "text-uva-text-muted")}>{nota}</dd>
      {enlace && (
        <dd className="order-4 mt-1">
          <Link
            href={enlace.href}
            scroll={false}
            className="inline-flex min-h-11 items-center text-uva-detalle font-semibold text-uva-accent-text underline-offset-4 hover:underline pointer-fine:min-h-0"
          >
            {enlace.texto}
          </Link>
        </dd>
      )}
    </div>
  );
}
