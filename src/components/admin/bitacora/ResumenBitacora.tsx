"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { COLOR_TIPO, TIPOS_BITACORA } from "@/lib/admin/bitacora-tipos";
import type { DiaBitacora, ResultadoBitacora } from "@/lib/admin/bitacora";
import { caminoSegmento } from "@/lib/admin/grafica";
import { cn } from "@/lib/utils";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function corto(dia: string) {
  const [, mes, d] = dia.split("-").map(Number);
  return `${d} ${MESES[mes - 1]}`;
}

/**
 * Resumen de los últimos 30 días: una barra por día, apilada por tipo, con un
 * punto rojo los días con acciones sensibles. Tocar una barra filtra la línea
 * de tiempo a ese día (y tocarla otra vez lo quita). Al lado, las tres cifras
 * que responden "¿pasó algo raro?".
 */
export function ResumenBitacora({
  resumen,
  ultimaTexto,
}: {
  resumen: ResultadoBitacora["resumen"];
  /** "hace 3 horas", calculado en el servidor para no desfasar la hidratación. */
  ultimaTexto: string | null;
}) {
  return (
    <section
      aria-labelledby="bitacora-resumen"
      className="grid rounded-uva-lg border border-uva-divider bg-uva-surface lg:grid-cols-[minmax(0,1fr)_14rem]"
    >
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:border-r lg:border-b-0 lg:px-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 id="bitacora-resumen" className="text-uva-cuerpo font-extrabold text-uva-text">
            Acciones por día, últimos 30 días
          </h2>
          <Leyenda />
        </div>
        <Grafica dias={resumen.dias} />
      </div>
      <dl className="grid grid-cols-3 lg:grid-cols-1">
        <Cifra valor={String(resumen.semana)} etiqueta="esta semana" />
        <Cifra
          valor={String(resumen.sensiblesSemana)}
          etiqueta={resumen.sensiblesSemana === 1 ? "sensible esta semana" : "sensibles esta semana"}
          sensible={resumen.sensiblesSemana > 0}
        />
        <Cifra valor={ultimaTexto ?? "Ninguna"} etiqueta={ultimaTexto ? "última acción" : "acción en 30 días"} pequena />
      </dl>
    </section>
  );
}

function Cifra({ valor, etiqueta, sensible, pequena }: { valor: string; etiqueta: string; sensible?: boolean; pequena?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col-reverse justify-end gap-0.5 border-l border-uva-divider px-4 py-4 first:border-l-0 max-[359px]:px-3 sm:px-5 lg:border-t lg:border-l-0 lg:first:border-t-0">
      <dt className="text-uva-detalle text-uva-text-muted">{etiqueta}</dt>
      <dd className={cn("flex items-center gap-2 font-mono font-extrabold text-uva-text", pequena ? "text-uva-cuerpo break-words sm:text-uva-titulo-4" : "text-uva-titulo-3")}>
        {sensible && <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-uva-error" />}
        {valor}
      </dd>
    </div>
  );
}

function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-uva-detalle text-uva-text-muted" aria-label="Leyenda">
      {TIPOS_BITACORA.map((tipo) => (
        <li key={tipo.clave} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-uva-xs" style={{ background: COLOR_TIPO[tipo.clave] }} />
          {tipo.nombre}
        </li>
      ))}
      <li className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2 rounded-full bg-uva-error" />
        Día con acciones sensibles
      </li>
    </ul>
  );
}

function etiquetaDia(dia: DiaBitacora, esHoy: boolean) {
  const nombre = esHoy ? "Hoy" : corto(dia.dia);
  if (!dia.total) return `${nombre}: sin acciones`;
  return `${nombre}: ${dia.total} ${dia.total === 1 ? "acción" : "acciones"}${dia.sensibles ? `, ${dia.sensibles} ${dia.sensibles === 1 ? "sensible" : "sensibles"}` : ""}`;
}

function Grafica({ dias }: { dias: DiaBitacora[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const contenedor = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(640);
  const [activo, setActivo] = useState<number | null>(null);

  // El SVG se dibuja al ancho real (no escalado): barras y esquinas no se
  // deforman en celular y el texto de los ejes conserva su tamaño.
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const observador = new ResizeObserver(([entrada]) => setAncho(Math.max(240, Math.round(entrada.contentRect.width))));
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  const diaElegido = searchParams.get("desde") && searchParams.get("desde") === searchParams.get("hasta") ? searchParams.get("desde") : null;

  function elegir(dia: string) {
    const params = new URLSearchParams(searchParams);
    if (diaElegido === dia) {
      params.delete("desde");
      params.delete("hasta");
    } else {
      params.set("desde", dia);
      params.set("hasta", dia);
    }
    params.delete("mostrar");
    const cadena = params.toString();
    startTransition(() => router.replace(cadena ? `${pathname}?${cadena}` : pathname, { scroll: false }));
  }

  const angosta = ancho < 480;
  const alto = angosta ? 120 : 170;
  const arriba = 18, abajo = 24, izquierda = 22;
  const maximo = Math.max(4, ...dias.map((d) => d.total));
  const tope = Math.ceil(maximo / 2) * 2;
  const paso = (ancho - izquierda) / dias.length;
  const grosor = Math.max(3, paso - (angosta ? 2 : 6));
  const escala = (valor: number) => ((alto - arriba - abajo) * valor) / tope;
  const base = alto - abajo;
  const marcas = angosta ? [0, dias.length - 1] : [0, 7, 14, 21, dias.length - 1];
  const ultimo = dias.length - 1;

  return (
    <div ref={contenedor} className="relative">
      {/* Ancho 100 % con viewBox: lo que pinta el servidor (a 640 px) ya
          cabe en la tarjeta antes de que cargue el JavaScript; si no, en un
          celular quedaban recortadas justo las barras recientes, a la
          derecha. Al medir, el viewBox pasa al ancho real y nada se deforma. */}
      <svg
        width="100%"
        height={alto}
        viewBox={`0 0 ${ancho} ${alto}`}
        preserveAspectRatio="none"
        role="group"
        aria-label="Acciones por día. Elige un día para ver solo sus acciones."
        className="block overflow-visible"
      >
        {[tope / 2, tope].map((valor) => {
          const y = base - escala(valor);
          return (
            <g key={valor} aria-hidden>
              <line x1={izquierda} x2={ancho} y1={y} y2={y} className="stroke-uva-divider" strokeDasharray="2 4" />
              <text x={0} y={y + 4} className="fill-uva-text-faint text-uva-etiqueta">{valor}</text>
            </g>
          );
        })}
        <line x1={izquierda} x2={ancho} y1={base} y2={base} className="stroke-uva-divider" aria-hidden />
        {dias.map((dia, i) => {
          const x = izquierda + i * paso + (paso - grosor) / 2;
          const tipos = TIPOS_BITACORA.filter((t) => dia.porTipo[t.clave]);
          let y = base;
          return (
            <g key={dia.dia}>
              <rect
                x={izquierda + i * paso}
                y={arriba - 10}
                width={paso}
                height={base - arriba + 10}
                rx={4}
                tabIndex={0}
                role="button"
                aria-pressed={diaElegido === dia.dia}
                aria-label={etiquetaDia(dia, i === ultimo)}
                className={cn(
                  "cursor-pointer fill-transparent outline-none hover:fill-uva-hover focus-visible:fill-uva-accent-soft focus-visible:stroke-uva-accent focus-visible:stroke-2",
                  diaElegido === dia.dia && "fill-uva-hover",
                )}
                onClick={() => elegir(dia.dia)}
                onKeyDown={(evento) => {
                  if (evento.key === "Enter" || evento.key === " ") {
                    evento.preventDefault();
                    elegir(dia.dia);
                  }
                }}
                onMouseEnter={() => setActivo(i)}
                onMouseLeave={() => setActivo(null)}
                onFocus={() => setActivo(i)}
                onBlur={() => setActivo(null)}
              />
              {tipos.map((tipo, j) => {
                const altoTipo = escala(dia.porTipo[tipo.clave] ?? 0);
                // 2 px de separación entre segmentos; solo el de arriba lleva esquinas.
                const visible = Math.max(1, altoTipo - (j < tipos.length - 1 ? 2 : 0));
                const camino = caminoSegmento(x, y, grosor, visible, j === tipos.length - 1);
                y -= altoTipo;
                return <path key={tipo.clave} d={camino} fill={COLOR_TIPO[tipo.clave]} className="pointer-events-none" aria-hidden />;
              })}
              {dia.sensibles > 0 && (
                <circle cx={x + grosor / 2} cy={y - 7} r={angosta ? 2.5 : 3.5} className="pointer-events-none fill-uva-error" aria-hidden />
              )}
            </g>
          );
        })}
        {marcas.map((i) => (
          <text
            key={i}
            aria-hidden
            x={i === 0 ? izquierda : i === ultimo ? ancho : izquierda + i * paso + paso / 2}
            y={alto - 6}
            textAnchor={i === 0 ? "start" : i === ultimo ? "end" : "middle"}
            className="fill-uva-text-faint text-uva-etiqueta"
          >
            {i === ultimo ? "hoy" : corto(dias[i].dia)}
          </text>
        ))}
      </svg>
      {activo !== null && <Tooltip dia={dias[activo]} esHoy={activo === ultimo} x={izquierda + activo * paso + paso / 2} ancho={ancho} elegido={diaElegido === dias[activo].dia} />}
    </div>
  );
}

function Tooltip({ dia, esHoy, x, ancho, elegido }: { dia: DiaBitacora; esHoy: boolean; x: number; ancho: number; elegido: boolean }) {
  const anchoTip = 208;
  const izquierda = Math.max(0, Math.min(x - anchoTip / 2, ancho - anchoTip));
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-full z-10 mb-1 rounded-uva-md border border-uva-divider bg-uva-surface px-3 py-2.5 text-uva-detalle shadow-uva-menu"
      style={{ left: izquierda, width: anchoTip }}
    >
      <p className="mb-1 font-bold text-uva-text">{esHoy ? "Hoy" : corto(dia.dia)}</p>
      {dia.total === 0 && <p className="text-uva-text-muted">Sin acciones</p>}
      {TIPOS_BITACORA.filter((t) => dia.porTipo[t.clave]).map((tipo) => (
        <p key={tipo.clave} className="flex items-center justify-between gap-2 text-uva-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-uva-xs" style={{ background: COLOR_TIPO[tipo.clave] }} />
            {tipo.nombre}
          </span>
          <span className="font-mono">{dia.porTipo[tipo.clave]}</span>
        </p>
      ))}
      {dia.sensibles > 0 && (
        <p className="mt-1 flex items-center justify-between gap-2 font-bold text-uva-error-text">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-uva-error" />
            Sensibles
          </span>
          <span className="font-mono">{dia.sensibles}</span>
        </p>
      )}
      <p className="mt-1.5 text-uva-text-muted">{elegido ? "Toca para ver todos los días" : "Toca para ver solo este día"}</p>
    </div>
  );
}
