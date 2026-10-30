"use client";

import { useEffect, useRef, useState } from "react";
import { corto, topeDe } from "@/components/admin/GraficaSemanas";
import { cn } from "@/lib/utils";

export type FilaDetalle = { texto: string; valor: string };

export const nombreSemana = (inicio: string, esActual: boolean) => (esActual ? "Esta semana" : `Semana del ${corto(inicio)}`);

/**
 * Una serie por semana en línea, las 12 semanas del panel. La última es la
 * semana en curso: va punteada y con el punto hueco, porque todavía no
 * termina y bajaría siempre. El número de la semana pasada, la última
 * completa, va escrito junto a su punto. Cada semana es un blanco con foco y
 * su etiqueta completa para lector de pantalla (mismo patrón que CurvaAvance).
 */
export function LineaSemanas({
  inicios,
  valores,
  etiqueta,
  describir,
  detalle,
  formato = String,
  formatoEje = formato,
  color,
  vacio,
}: {
  /** Lunes de cada semana, "YYYY-MM-DD". */
  inicios: string[];
  valores: number[];
  etiqueta: string;
  /** Para el lector de pantalla, sin el nombre de la semana: "41 personas estudiaron". */
  describir: (i: number) => string;
  detalle: (i: number) => FilaDetalle[];
  formato?: (valor: number) => string;
  formatoEje?: (valor: number) => string;
  /** Clases de trazo y relleno: `stroke-uva-serie-1 fill-uva-serie-1`. */
  color: string;
  vacio: { titulo: string; texto: string };
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [activa, setActiva] = useState<number | null>(null);

  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.max(240, Math.round(entrada.contentRect.width))));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const angosta = ancho < 480;
  const alto = angosta ? 160 : 220;
  const maximo = Math.max(0, ...valores);
  const tope = topeDe(maximo);
  // Sin datos solo va la base: «$0, $0, $0» en el eje no dice nada.
  const marcas = maximo > 0 ? [0, tope / 2, tope] : [0];
  const etiquetasEje = marcas.map(formatoEje);
  // El ancho de la etiqueta más larga del eje, a ojo: 7 px por letra.
  const izquierda = Math.max(26, Math.max(...etiquetasEje.map((t) => t.length)) * 7 + 8);
  const arriba = 22,
    abajo = 26,
    derecha = 12;
  const ultima = valores.length - 1;
  const x = (i: number) => izquierda + (i * (ancho - izquierda - derecha)) / Math.max(1, ultima);
  const y = (valor: number) => arriba + (1 - valor / tope) * (alto - arriba - abajo);
  const base = y(0);
  const paso = x(1) - x(0);
  const completas = valores
    .slice(0, ultima)
    .map((v, i) => `${x(i)},${y(v)}`)
    .join(" ");
  // Fechas cada tantas semanas, sin pisar «Esta semana», que va al final.
  const cadaCuanto = Math.ceil(ultima / Math.max(1, Math.floor((ancho - izquierda - 90) / 64)));

  return (
    <div ref={contenedor} className="relative">
      <svg
        width="100%"
        height={alto}
        viewBox={`0 0 ${ancho} ${alto}`}
        role="group"
        aria-label={etiqueta}
        className="block overflow-visible"
      >
        {marcas.map((valor, i) => (
          <g key={valor} aria-hidden>
            <line
              x1={izquierda}
              x2={ancho - derecha}
              y1={y(valor)}
              y2={y(valor)}
              className="stroke-uva-divider"
              strokeDasharray={valor === 0 ? undefined : "2 4"}
            />
            <text x={izquierda - 6} y={y(valor) + 4} textAnchor="end" className="fill-uva-text-faint text-uva-etiqueta">
              {etiquetasEje[i]}
            </text>
          </g>
        ))}
        {inicios.map((inicio, i) =>
          i === ultima || (i % cadaCuanto === cadaCuanto - 1 && x(ultima) - x(i) > 80) ? (
            <text
              key={inicio}
              aria-hidden
              x={x(i)}
              y={alto - 8}
              textAnchor={i === ultima ? "end" : "middle"}
              className="fill-uva-text-faint text-uva-etiqueta"
            >
              {i === ultima ? "Esta semana" : corto(inicio)}
            </text>
          ) : null,
        )}

        {maximo > 0 && (
          <g aria-hidden className={color}>
            <polygon
              points={`${x(0)},${base} ${completas} ${x(ultima - 1)},${base}`}
              fillOpacity={0.14}
              className="stroke-none"
            />
            <polyline points={completas} className="fill-none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            <line
              x1={x(ultima - 1)}
              y1={y(valores[ultima - 1])}
              x2={x(ultima)}
              y2={y(valores[ultima])}
              strokeWidth={2.5}
              strokeDasharray="5 5"
              strokeLinecap="round"
            />
            {valores.map((valor, i) => (
              <circle
                key={i}
                cx={x(i)}
                cy={y(valor)}
                r={i === activa || i >= ultima - 1 ? 4.5 : 3}
                strokeWidth={i === ultima ? 2.5 : 0}
                className={cn(i === ultima && "fill-uva-surface")}
              />
            ))}
            <text
              x={x(ultima - 1) - 8}
              y={y(valores[ultima - 1]) - 10}
              textAnchor="end"
              className="fill-uva-text stroke-none text-uva-detalle font-extrabold"
            >
              {formato(valores[ultima - 1])}
            </text>
          </g>
        )}

        {maximo > 0 &&
          valores.map((_, i) => (
            <rect
              key={i}
              x={x(i) - paso / 2}
              y={arriba - 8}
              width={paso}
              height={base - arriba + 8}
              tabIndex={0}
              role="img"
              aria-label={`${i === ultima ? "Esta semana, hasta hoy" : nombreSemana(inicios[i], false)}: ${describir(i)}`}
              className="fill-transparent outline-none hover:fill-uva-hover/60 focus-visible:fill-uva-accent-soft focus-visible:stroke-uva-accent focus-visible:stroke-2"
              onMouseEnter={() => setActiva(i)}
              onMouseLeave={() => setActiva(null)}
              onFocus={() => setActiva(i)}
              onBlur={() => setActiva(null)}
            />
          ))}
      </svg>

      {maximo === 0 && (
        <div className="absolute inset-x-6 top-2 bottom-8 grid place-content-center gap-1 text-center">
          <p className="m-0 font-bold text-uva-text">{vacio.titulo}</p>
          <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">{vacio.texto}</p>
        </div>
      )}

      {activa !== null && (
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-uva-md border border-uva-divider bg-uva-surface px-3 py-2.5 text-uva-detalle shadow-uva-menu"
          style={{
            left: Math.max(0, Math.min(x(activa) - 110, ancho - 220)),
            width: 220,
          }}
        >
          <p className="m-0 font-bold text-uva-text">{nombreSemana(inicios[activa], activa === ultima)}</p>
          {activa === ultima && <p className="m-0 text-uva-text-muted">Va hasta hoy</p>}
          {detalle(activa).map((fila) => (
            <p key={fila.texto} className="m-0 mt-1 flex justify-between gap-2 text-uva-text-muted">
              <span>{fila.texto}</span>
              <span className="font-mono text-uva-text">{fila.valor}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
