import Link from "next/link";
import type { CSSProperties } from "react";
import { Cifra } from "@/components/admin/GraficaSemanas";
import { DIAS_ESTUDIO_CURSOS, DIAS_SIN_AVANZAR } from "@/lib/admin/avance";
import type { ResumenCursos as Resumen } from "@/lib/admin/cursos";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Una barra por curso publicado: el largo son las personas que lo empezaron y
 * el tramo verde, las que terminaron todas las clases. Barras y no línea: los
 * cursos se comparan entre sí, no siguen un orden. Los dos tramos arrancan del
 * mismo borde, así que tanto el total como los que terminaron se comparan.
 */
function CuantoTerminan({ cursos }: { cursos: Resumen["cursos"] }) {
  const orden = cursos
    .filter((curso) => curso.mostrado && curso.empezaron > 0)
    .sort((a, b) => b.empezaron - a.empezaron || a.titulo.localeCompare(b.titulo));
  const maximo = Math.max(0, ...orden.map((curso) => curso.empezaron));

  if (maximo === 0) {
    return (
      <div className="grid justify-items-center gap-1 px-3 py-7 text-center">
        <p className="m-0 font-bold text-uva-text">Nadie ha empezado un curso publicado</p>
        <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">Cuando alguien vea una clase, aquí sale cuánto avanza.</p>
      </div>
    );
  }

  return (
    <>
      <p aria-hidden className="m-0 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-uva-detalle text-uva-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-uva-xs bg-uva-serie-3" />
          Terminaron
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-uva-xs bg-uva-serie-1" />
          Siguen o dejaron
        </span>
      </p>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {orden.map((curso) => (
          <li key={curso.id} className="grid gap-x-4 gap-y-1 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-center">
            <span className="min-w-0 truncate text-uva-detalle font-semibold text-uva-text" title={curso.titulo}>
              {curso.titulo}
            </span>
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                style={{ "--ancho": `${(curso.empezaron / maximo) * 100}%` } as CSSProperties}
                className="flex h-4.5 w-[calc(var(--ancho)*0.48)] shrink-0 overflow-hidden rounded-r-uva-xs bg-uva-serie-1 md:w-[calc(var(--ancho)*0.5)]"
              >
                <span
                  style={{ width: `${(curso.terminaron / curso.empezaron) * 100}%` }}
                  className="h-full bg-uva-serie-3"
                />
              </span>
              <span className="min-w-0 text-uva-detalle text-uva-text-muted">
                <span className="font-mono font-bold text-uva-text">{curso.empezaron}</span> empezaron
                <span className="block whitespace-nowrap">
                  {curso.terminaron} terminaron ({Math.round((curso.terminaron / curso.empezaron) * 100)} %)
                </span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

function DondeSeAtasca({ atascos }: { atascos: Resumen["atascos"] }) {
  if (atascos.length === 0) {
    return (
      <div className="grid justify-items-center gap-1 px-3 py-7 text-center">
        <p className="m-0 font-bold text-uva-text">Nadie se ha quedado en una clase</p>
        <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">
          Aquí salen las clases que alguien empezó y lleva {DIAS_SIN_AVANZAR} días o más sin terminar.
        </p>
      </div>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {atascos.map((atasco) => (
        <li key={atasco.idLeccion} className="border-t border-uva-divider first:border-t-0">
          <Link
            href={`/admin/cursos/${atasco.cursoSlug}?pestana=estudiantes`}
            className="-mx-2 grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 rounded-uva-sm px-2 py-2.5 hover:bg-uva-hover"
          >
            <span className="min-w-0">
              <span className="block text-uva-detalle font-bold break-words text-uva-text">{atasco.leccion}</span>
              <span className="block text-uva-detalle text-uva-text-muted">
                {atasco.curso} · {atasco.modulo}
              </span>
            </span>
            <span className="text-right text-uva-detalle text-uva-text-muted">
              <span className="block font-mono text-uva-titulo-4 font-extrabold text-uva-accent-2-text">{atasco.personas}</span>
              {atasco.personas === 1 ? "persona" : "personas"}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export function ResumenCursos({ resumen }: { resumen: Resumen }) {
  const { cursos } = resumen;
  const publicados = cursos.filter((curso) => curso.mostrado).length;

  return (
    <section aria-label="Cómo van los cursos" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
      <div className="grid border-b border-uva-divider lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <div className="min-w-0 p-4 sm:p-5 lg:px-6">
          <h2 className="m-0 text-uva-cuerpo font-extrabold text-uva-text">Cuánto terminan</h2>
          <p className="m-0 mb-3 text-uva-detalle text-uva-text-muted">
            Personas que empezaron cada curso publicado y cuántas terminaron todas las clases.
          </p>
          <CuantoTerminan cursos={cursos} />
        </div>
        <div className="min-w-0 border-uva-divider p-4 max-lg:border-t sm:p-5 lg:border-l lg:px-6">
          <h2 className="m-0 text-uva-cuerpo font-extrabold text-uva-text">Dónde se atasca la gente</h2>
          <p className="m-0 mb-3 text-uva-detalle text-uva-text-muted">
            Clases que la gente empezó y lleva {DIAS_SIN_AVANZAR} días o más sin terminar.
          </p>
          <DondeSeAtasca atascos={resumen.atascos} />
        </div>
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        <Cifra
          enFila
          valor={`${publicados} de ${cursos.length}`}
          etiqueta={cursos.length === 1 ? "curso publicado" : "cursos publicados"}
          nota={`${cursos.length - publicados} en borrador`}
        />
        <Cifra
          enFila
          valor={String(resumen.personas)}
          etiqueta={resumen.personas === 1 ? "persona estudió" : "personas estudiaron"}
          nota={`En los últimos ${DIAS_ESTUDIO_CURSOS} días, sin repetir`}
        />
        <Cifra
          enFila
          valor={String(resumen.certificados)}
          etiqueta={resumen.certificados === 1 ? "certificado" : "certificados"}
          nota={`Emitidos en los últimos ${DIAS_ESTUDIO_CURSOS} días`}
        />
        <Cifra
          enFila
          valor={String(resumen.seQuedaron)}
          etiqueta={resumen.seQuedaron === 1 ? "dejó un curso a medias" : "dejaron un curso a medias"}
          nota={`${plural(DIAS_SIN_AVANZAR, "día", "días")} o más sin avanzar`}
          alerta={resumen.seQuedaron > 0}
        />
      </dl>
    </section>
  );
}
