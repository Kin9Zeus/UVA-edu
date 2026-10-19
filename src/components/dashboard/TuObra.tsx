import type { ResumenObra } from "@/lib/dashboard";

/** Cada torre tiene 5 pisos: al terminar el quinto curso se "entrega" y el
 *  siguiente empieza una torre nueva. */
const PISOS_POR_TORRE = 5;
/** Torres entregadas que se dibujan en miniatura; las demás van como "+N". */
const TORRES_VISIBLES = 8;

type Piso = {
  izq: string;
  der: string;
  techo: string;
  numero: number;
  arriba: number;
};

/** Cálculo de la torre a partir de los cursos terminados (exportado para el test). */
export function calcularTorre(cursosTerminados: number) {
  const t = Math.max(0, cursosTerminados);
  let entregadas = Math.floor(t / PISOS_POR_TORRE);
  let pisos = t % PISOS_POR_TORRE;
  let completa = false;
  // Justo al terminar el 5.º, 10.º… curso la torre se ve completa (5 de 5),
  // no vacía: se entrega recién con el curso siguiente.
  if (pisos === 0 && t > 0) {
    completa = true;
    entregadas -= 1;
    pisos = PISOS_POR_TORRE;
  }
  const torre = entregadas + 1;
  const texto =
    t === 0
      ? "Aún no hay pisos. Termina tu primer curso y se construye el piso 1."
      : completa
        ? `Torre ${torre} entregada: 5 de 5 pisos. El próximo curso empieza la torre ${torre + 1}.`
        : `Torre ${torre}: ${pisos === 1 ? "1 piso construido" : `${pisos} pisos construidos`} de 5. Cada 5 cursos se entrega una torre.`;
  return { entregadas, pisos, texto };
}

function pisosDibujados(cantidad: number): Piso[] {
  return Array.from({ length: cantidad }, (_, i) => {
    const d = -26 * i;
    return {
      izq: `M44 ${150 + d} L100 ${182 + d} L100 ${208 + d} L44 ${176 + d} Z`,
      der: `M156 ${150 + d} L100 ${182 + d} L100 ${208 + d} L156 ${176 + d} Z`,
      techo: `M100 ${118 + d} L156 ${150 + d} L100 ${182 + d} L44 ${150 + d} Z`,
      numero: i + 1,
      // Posición del número en % del alto del dibujo (viewBox de 240).
      arriba: ((160 + d) / 240) * 100,
    };
  });
}

function Torre({ dibujo, etiqueta }: { dibujo: Piso[]; etiqueta: string }) {
  return (
    <svg
      viewBox="0 0 200 240"
      role="img"
      aria-label={etiqueta}
      className="block h-auto w-full"
    >
      <path
        d="M100 158 L184 180 L100 242 L16 180 Z"
        className="fill-uva-maqueta-base stroke-uva-maqueta-arista-suave"
      />
      <path
        d="M44 46 L100 14 L156 46 L156 176 L100 208 L44 176 Z M44 46 L100 78 L156 46 M100 78 V208 M44 150 L100 182 L156 150 M44 124 L100 156 L156 124 M44 98 L100 130 L156 98 M44 72 L100 104 L156 72"
        fill="none"
        strokeLinejoin="round"
        className="stroke-uva-line-strong"
      />
      {dibujo.map((piso) => (
        <g
          key={piso.numero}
          strokeLinejoin="round"
          className="stroke-uva-maqueta-arista"
        >
          <path d={piso.izq} className="fill-uva-maqueta-izq" />
          <path d={piso.der} className="fill-uva-maqueta-der" />
          <path d={piso.techo} className="fill-uva-accent-2" />
        </g>
      ))}
    </svg>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-uva-divider py-2 text-uva-detalle">
      <dt className="text-uva-text-muted">{etiqueta}</dt>
      <dd className="font-mono font-extrabold text-uva-text">{valor}</dd>
    </div>
  );
}

/**
 * "Tu obra" del inicio: cada curso terminado suma un piso a una torre
 * isométrica. Los números de al lado son reales; si notas o racha no se
 * pudieron leer, se dice "sin dato" en vez de mostrar un 0 que no es cierto.
 */
export function TuObra({ resumen }: { resumen: ResumenObra }) {
  const { entregadas, pisos, texto } = calcularTorre(resumen.cursosTerminados);
  const dibujo = pisosDibujados(pisos);
  const visibles = Math.min(entregadas, TORRES_VISIBLES);

  const torre = entregadas + 1;
  const completa =
    resumen.cursosTerminados > 0 &&
    resumen.cursosTerminados % PISOS_POR_TORRE === 0;
  const resumenCorto =
    resumen.cursosTerminados === 0
      ? "Termina tu primer curso y sube el piso 1."
      : completa
        ? `Torre ${torre} entregada. El próximo curso empieza la ${torre + 1}.`
        : `Torre ${torre}. Cada curso que terminas suma un piso.`;

  return (
    <>
      {/* Celular y tablet: franja compacta, como el diseño. Desde 1024 px, el resumen completo. */}
      <section
        aria-labelledby="inicio-obra-movil"
        className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-3.5 border-y border-uva-divider py-4 md:hidden"
      >
        <div className="w-[72px]">
          <Torre dibujo={dibujo} etiqueta={`Tu obra: ${texto}`} />
        </div>
        <div className="min-w-0">
          <h2
            id="inicio-obra-movil"
            className="text-uva-titulo-4 font-extrabold text-uva-text"
          >
            Tu obra
          </h2>
          <p className="mt-0.5 text-uva-detalle text-uva-text-muted">
            {resumenCorto}
          </p>
        </div>
        <p className="text-right leading-tight">
          <span className="block font-mono text-uva-titulo-3 font-extrabold text-uva-text">
            {pisos} de {PISOS_POR_TORRE}
          </span>
          <span className="text-uva-detalle text-uva-text-muted">pisos</span>
        </p>
      </section>

      <section
        aria-labelledby="inicio-obra"
        className="hidden flex-col gap-2.5 border-t border-uva-divider pt-5 pb-4 md:flex lg:border-t-0 lg:pt-0 xl:gap-2 xl:pb-2"
      >
        <h2 id="inicio-obra" className="text-uva-titulo-4 text-uva-text">
          Tu obra
        </h2>
        <p className="text-uva-detalle text-uva-text-muted">
          Cada curso que terminas suma un piso.
        </p>

        <div className="flex items-center gap-3">
          <div className="relative w-[150px] shrink-0 sm:w-[170px] xl:w-[120px]">
            <Torre dibujo={dibujo} etiqueta={`Tu obra: ${texto}`} />
            {dibujo.map((piso) => (
              <span
                key={piso.numero}
                aria-hidden="true"
                style={{ top: `${piso.arriba}%` }}
                className="absolute left-[83%] font-mono text-uva-detalle leading-none font-bold text-uva-text"
              >
                {piso.numero}
              </span>
            ))}
          </div>

          <dl className="min-w-0 flex-1">
            <Dato
              etiqueta="Cursos terminados"
              valor={String(resumen.cursosTerminados)}
            />
            <Dato
              etiqueta="Clases vistas"
              valor={String(resumen.clasesVistas)}
            />
            <Dato
              etiqueta="Notas guardadas"
              valor={
                resumen.notasGuardadas === null
                  ? "Sin dato"
                  : String(resumen.notasGuardadas)
              }
            />
            <Dato
              etiqueta="Racha"
              valor={
                resumen.racha === null
                  ? "Sin dato"
                  : `${resumen.racha} ${resumen.racha === 1 ? "día" : "días"}`
              }
            />
          </dl>
        </div>

        <p className="text-uva-detalle text-uva-text-muted">{texto}</p>

        {entregadas > 0 && (
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-uva-detalle font-bold text-uva-text">
              Obras entregadas
            </span>
            <span
              role="img"
              aria-label={`${entregadas} ${entregadas === 1 ? "torre entregada" : "torres entregadas"}`}
              className="inline-flex items-end gap-[3px]"
            >
              {Array.from({ length: visibles }, (_, i) => (
                <svg
                  key={i}
                  viewBox="0 0 14 22"
                  aria-hidden="true"
                  className="block h-[22px] w-[14px]"
                >
                  <path
                    d="M1 5 L7 2 L13 5 V19 L7 21 L1 19 Z"
                    strokeLinejoin="round"
                    className="fill-uva-maqueta-izq stroke-uva-maqueta-arista"
                  />
                  <path
                    d="M7 8 V21 M1 5 L7 8 L13 5"
                    fill="none"
                    className="stroke-uva-maqueta-arista"
                  />
                </svg>
              ))}
            </span>
            {entregadas > visibles && (
              <span className="font-mono text-uva-detalle font-extrabold text-uva-text">
                +{entregadas - visibles}
              </span>
            )}
          </div>
        )}
      </section>
    </>
  );
}
