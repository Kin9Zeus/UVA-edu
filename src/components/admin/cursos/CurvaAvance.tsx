"use client";

import { useEffect, useRef, useState } from "react";
import { DIAS_SIN_AVANZAR } from "@/lib/admin/avance";

export type PuntoCurva = {
  /** "3.1": módulo y lugar de la clase en el módulo, como en Contenido. */
  numero: string;
  titulo: string;
  modulo: number;
  nombreModulo: string;
  terminaron: number;
  seQuedaron: number;
};

/** Tope del eje: múltiplo de 5 o 10 que deja aire sobre el máximo. */
function topeDe(maximo: number) {
  const paso = maximo <= 20 ? 5 : 10;
  return Math.max(paso, Math.ceil((maximo * 1.08) / paso) * paso);
}

/** El tramo entre dos clases donde más personas se pierden (índice de la segunda). */
export function mayorCaida(puntos: PuntoCurva[]): number | null {
  let peor: number | null = null;
  for (let i = 1; i < puntos.length; i++) {
    const caida = puntos[i - 1].terminaron - puntos[i].terminaron;
    if (caida > 0 && (peor === null || caida > puntos[peor - 1].terminaron - puntos[peor].terminaron)) peor = i;
  }
  return peor;
}

/**
 * Curva de retención, como la de YouTube: las clases en orden y cuántas
 * personas terminaron cada una. Línea y no barras porque las clases son una
 * secuencia: la pendiente dice dónde se pierde la gente, y un curso de 40
 * clases cabe igual. El tramo que más cae va en otro color; un aro marca las
 * clases donde alguien se quedó. Cada clase es un blanco con foco y su
 * etiqueta completa para lector de pantalla.
 */
export function CurvaAvance({ puntos }: { puntos: PuntoCurva[] }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [activo, setActivo] = useState<number | null>(null);

  // Se dibuja al ancho real; el viewBox hace que lo pintado en el servidor
  // quepa antes de medir (mismo patrón que GraficaSemanas).
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.max(240, Math.round(entrada.contentRect.width))));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const angosta = ancho < 480;
  const alto = angosta ? 190 : 250;
  const arriba = 22, abajo = 26, izquierda = 30, derecha = 10;
  const tope = topeDe(Math.max(...puntos.map((p) => p.terminaron)));
  const x = (i: number) => izquierda + (i * (ancho - izquierda - derecha)) / Math.max(1, puntos.length - 1);
  const y = (valor: number) => arriba + (1 - valor / tope) * (alto - arriba - abajo);
  const base = y(0);
  const caida = mayorCaida(puntos);
  const linea = puntos.map((p, i) => `${x(i)},${y(p.terminaron)}`).join(" ");
  // En celular, un número de clase sí y uno no; con muchas clases, menos.
  const cadaCuanto = Math.max(1, Math.ceil(puntos.length / Math.floor((ancho - izquierda) / (angosta ? 34 : 40))));

  return (
    <div ref={contenedor} className="relative">
      <svg
        width="100%"
        height={alto}
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        role="group"
        aria-label="Personas que terminaron cada clase, en orden"
        className="block overflow-visible"
      >
        {[tope / 2, tope].map((valor) => (
          <g key={valor} aria-hidden>
            <line x1={izquierda} x2={ancho - derecha} y1={y(valor)} y2={y(valor)} className="stroke-uva-divider" strokeDasharray="2 4" />
            <text x={izquierda - 6} y={y(valor) + 4} textAnchor="end" className="fill-uva-text-faint text-uva-etiqueta">
              {valor}
            </text>
          </g>
        ))}
        <line x1={izquierda} x2={ancho - derecha} y1={base} y2={base} className="stroke-uva-divider" aria-hidden />
        <text x={izquierda - 6} y={base + 4} textAnchor="end" className="fill-uva-text-faint text-uva-etiqueta" aria-hidden>
          0
        </text>

        {/* Separador y nombre corto de cada módulo. */}
        {puntos.map((punto, i) => {
          if (i > 0 && punto.modulo === puntos[i - 1].modulo) return null;
          const xm = i === 0 ? izquierda : (x(i) + x(i - 1)) / 2;
          return (
            <g key={`m${punto.modulo}`} aria-hidden>
              {i > 0 && <line x1={xm} x2={xm} y1={arriba - 8} y2={base} className="stroke-uva-divider" strokeDasharray="2 4" />}
              <text x={xm + (i === 0 ? 0 : 5)} y={11} className="fill-uva-text-faint text-uva-etiqueta">
                {angosta ? `M${punto.modulo}` : `Módulo ${punto.modulo}`}
              </text>
            </g>
          );
        })}

        <polygon
          aria-hidden
          points={`${izquierda},${base} ${linea} ${x(puntos.length - 1)},${base}`}
          className="fill-uva-serie-1"
          fillOpacity={0.14}
        />
        <polyline aria-hidden points={linea} fill="none" className="stroke-uva-serie-1" strokeWidth={2.5} strokeLinejoin="round" />
        {caida !== null && (
          <line
            aria-hidden
            x1={x(caida - 1)}
            y1={y(puntos[caida - 1].terminaron)}
            x2={x(caida)}
            y2={y(puntos[caida].terminaron)}
            className="stroke-uva-serie-2"
            strokeWidth={4}
            strokeLinecap="round"
          />
        )}

        {puntos.map((punto, i) => {
          const antes = i > 0 ? (x(i) - x(i - 1)) / 2 : 10;
          const despues = i < puntos.length - 1 ? (x(i + 1) - x(i)) / 2 : derecha;
          return (
            <g key={punto.numero}>
              {i % cadaCuanto === 0 && (
                <text aria-hidden x={x(i)} y={alto - 8} textAnchor="middle" className="fill-uva-text-faint text-uva-etiqueta">
                  {punto.numero}
                </text>
              )}
              {punto.seQuedaron > 0 && (
                <circle aria-hidden cx={x(i)} cy={y(punto.terminaron)} r={7} fill="none" className="stroke-uva-accent-2-text" strokeWidth={2} />
              )}
              <circle
                aria-hidden
                cx={x(i)}
                cy={y(punto.terminaron)}
                r={activo === i ? 5 : 3.5}
                className="fill-uva-serie-1 stroke-uva-surface"
                strokeWidth={1.5}
              />
              <rect
                x={x(i) - antes}
                y={arriba - 8}
                width={antes + despues}
                height={base - arriba + 8}
                tabIndex={0}
                role="img"
                aria-label={`Clase ${punto.numero}, ${punto.titulo}: ${punto.terminaron} la terminaron${
                  punto.seQuedaron > 0 ? `, ${punto.seQuedaron} se ${punto.seQuedaron === 1 ? "quedó" : "quedaron"} ahí` : ""
                }`}
                className="fill-transparent outline-none hover:fill-uva-hover/60 focus-visible:fill-uva-accent-soft focus-visible:stroke-uva-accent focus-visible:stroke-2"
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              />
            </g>
          );
        })}
      </svg>
      {activo !== null && <Detalle punto={puntos[activo]} x={x(activo)} ancho={ancho} />}
    </div>
  );
}

function Detalle({ punto, x, ancho }: { punto: PuntoCurva; x: number; ancho: number }) {
  const anchoTip = 232;
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-uva-md border border-uva-divider bg-uva-surface px-3 py-2.5 text-uva-detalle shadow-uva-menu"
      style={{ left: Math.max(0, Math.min(x - anchoTip / 2, ancho - anchoTip)), width: anchoTip }}
    >
      <p className="m-0 font-bold text-uva-text">
        {punto.numero} {punto.titulo}
      </p>
      <p className="m-0 mb-1 text-uva-text-muted">
        Módulo {punto.modulo}: {punto.nombreModulo}
      </p>
      <p className="m-0 flex justify-between gap-2 text-uva-text-muted">
        <span>La terminaron</span>
        <span className="font-mono text-uva-text">{punto.terminaron}</span>
      </p>
      {punto.seQuedaron > 0 && (
        <p className="m-0 flex justify-between gap-2 text-uva-text-muted">
          <span>Se quedaron ({DIAS_SIN_AVANZAR}+ días)</span>
          <span className="font-mono font-bold text-uva-accent-2-text">{punto.seQuedaron}</span>
        </p>
      )}
    </div>
  );
}
