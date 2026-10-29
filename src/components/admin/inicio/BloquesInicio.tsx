import Link from "next/link";
import type { CSSProperties } from "react";
import { Award, MessageSquare, Ticket, UserPlus } from "lucide-react";
import { DIAS_ESTUDIO_CURSOS } from "@/lib/admin/avance";
import { tiempoRelativo } from "@/lib/admin/format";
import { mayorPerdida, type DatosInicio, type EventoInicio } from "@/lib/admin/dashboard";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

const TITULO = "text-uva-cuerpo font-extrabold text-uva-text";
const TARJETA = "flex min-w-0 flex-col gap-3 rounded-uva-lg border border-uva-divider bg-uva-surface p-4 sm:p-5";

/**
 * Cuántas personas llegan a cada paso, desde siempre. Barras y no línea: son
 * pasos de un recorrido, cada uno sobre el total de registrados. Donde más
 * gente se pierde se marca con su cifra, como la mayor caída de la curva de
 * un curso. Debajo, quién tiene acceso hoy y de dónde le viene.
 */
export function Embudo({ embudo, accesoHoy }: Pick<DatosInicio, "embudo" | "accesoHoy">) {
  const registrados = embudo[0].personas;
  const peor = mayorPerdida(embudo);
  const reparto = [
    {
      clave: "invitacion",
      valor: accesoHoy.invitacion,
      texto: "por invitación",
      color: "bg-uva-serie-1",
    },
    {
      clave: "uva",
      valor: accesoHoy.uva,
      texto: accesoHoy.uva === 1 ? "dado por U.V.A." : "dados por U.V.A.",
      color: "bg-uva-serie-3",
    },
    {
      clave: "pagan",
      valor: accesoHoy.pagan,
      texto: accesoHoy.pagan === 1 ? "paga un plan" : "pagan un plan",
      color: "bg-uva-serie-4",
    },
  ].filter((r) => r.valor > 0);

  return (
    <section aria-labelledby="inicio-embudo" className={TARJETA}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="inicio-embudo" className={TITULO}>
          Del registro al certificado
        </h2>
        <p className="text-uva-detalle text-uva-text-muted">Desde el inicio</p>
      </div>
      <p className="-mt-2 text-uva-detalle text-uva-text-muted">Cuántas personas llegan a cada paso.</p>

      <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
        {embudo.map((paso, i) => (
          <li key={paso.etiqueta} className="flex flex-col gap-1">
            {i === peor && (
              <p className="m-0 flex items-center gap-1.5 text-uva-detalle font-bold text-uva-text md:pl-[calc(11rem+0.875rem)]">
                <span aria-hidden className="h-0.5 w-2.5 bg-uva-serie-2" />
                Aquí se pierden {plural(embudo[i - 1].personas - paso.personas, "persona", "personas")}
              </p>
            )}
            <div className="grid gap-x-3.5 gap-y-1 md:grid-cols-[11rem_minmax(0,1fr)] md:items-center">
              <span className="text-uva-detalle font-semibold text-uva-text">{paso.etiqueta}</span>
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  aria-hidden
                  style={
                    {
                      "--ancho": `${registrados > 0 ? (paso.personas / registrados) * 100 : 0}%`,
                    } as CSSProperties
                  }
                  className="h-4.5 w-[calc(var(--ancho)*0.6)] shrink-0 rounded-r-uva-xs bg-uva-serie-1"
                />
                <span className="text-uva-detalle whitespace-nowrap text-uva-text-muted">
                  <span className="font-mono font-extrabold text-uva-text">{paso.personas}</span>
                  {i > 0 && registrados > 0 && ` (${Math.round((paso.personas / registrados) * 100)} %)`}
                </span>
              </span>
            </div>
          </li>
        ))}
      </ol>
      {registrados > 0 && embudo[1].personas === 0 && (
        <p className="m-0 text-uva-detalle text-uva-text-muted">
          Cuando alguien entre con un código y vea una clase, aquí se ve cuántos llegan a cada paso.
        </p>
      )}

      <div className="flex flex-col gap-2 border-t border-uva-divider pt-3">
        <p className="m-0 text-uva-detalle text-uva-text-muted">
          <span className="font-mono font-extrabold text-uva-text">{accesoHoy.total}</span>{" "}
          {accesoHoy.total === 1 ? "persona tiene" : "personas tienen"} acceso hoy
        </p>
        {accesoHoy.total > 0 && (
          <>
            <div aria-hidden className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
              {reparto.map((r) => (
                <span key={r.clave} className={r.color} style={{ width: `${(r.valor / accesoHoy.total) * 100}%` }} />
              ))}
            </div>
            <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-uva-detalle text-uva-text-muted">
              {reparto.map((r) => (
                <li key={r.clave} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-2.5 rounded-uva-xs ${r.color}`} />
                  {r.valor} {r.texto}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

/** Los cursos con más personas estudiando en los últimos 30 días. */
export function CursosAhora({ cursos }: { cursos: DatosInicio["cursos30"] }) {
  const maximo = cursos[0]?.personas ?? 0;
  return (
    <section aria-labelledby="inicio-cursos" className={TARJETA}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="inicio-cursos" className={TITULO}>
          Qué se estudia ahora
        </h2>
        <Link href="/admin/cursos" className="text-uva-detalle font-semibold text-uva-accent-text hover:underline">
          Ver cursos
        </Link>
      </div>
      <p className="-mt-2 text-uva-detalle text-uva-text-muted">
        Personas que estudiaron cada curso en los últimos {DIAS_ESTUDIO_CURSOS} días.
      </p>
      {cursos.length === 0 ? (
        <p className="m-0 py-2 text-uva-detalle text-uva-text-muted">
          Nadie ha estudiado en los últimos {DIAS_ESTUDIO_CURSOS} días.
        </p>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0">
          {cursos.map((curso) => (
            <li key={curso.id} className="border-t border-uva-divider first:border-t-0">
              <Link
                href={`/admin/cursos/${curso.slug}?pestana=estudiantes`}
                className="-mx-2 grid min-h-11 grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 rounded-uva-md px-2 py-2.5 hover:bg-uva-hover"
              >
                <span className="truncate text-uva-detalle font-bold text-uva-text" title={curso.titulo}>
                  {curso.titulo}
                </span>
                <span className="text-right text-uva-detalle whitespace-nowrap text-uva-text-muted">
                  <span className="font-mono font-extrabold text-uva-text">{curso.personas}</span>{" "}
                  {curso.personas === 1 ? "persona" : "personas"}
                </span>
                <span aria-hidden className="col-span-2 h-1.5 overflow-hidden rounded-full bg-uva-surface-2">
                  <span
                    className="block h-full rounded-full bg-uva-serie-1"
                    style={{ width: `${(curso.personas / maximo) * 100}%` }}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

const ICONO: Record<EventoInicio["tipo"], typeof UserPlus> = {
  registro: UserPlus,
  canje: Ticket,
  certificado: Award,
  comunidad: MessageSquare,
};

/** Lo último que hicieron los estudiantes; el nombre lleva a su ficha. */
export function LoUltimo({ actividad }: { actividad: EventoInicio[] }) {
  return (
    <section aria-labelledby="inicio-ultimo" className={TARJETA}>
      <h2 id="inicio-ultimo" className={TITULO}>
        Lo último que pasó
      </h2>
      {actividad.length === 0 ? (
        <p className="m-0 py-2 text-uva-detalle text-uva-text-muted">
          Todavía no pasa nada. Aquí salen registros, canjes de código, certificados y lo que se publica en la comunidad.
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-x-7 p-0 md:grid-cols-2">
          {actividad.map((evento, i) => {
            const Icono = ICONO[evento.tipo];
            return (
              <li
                key={evento.id}
                className={`grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3 border-uva-divider py-2.5 ${i > 0 ? "border-t" : ""} ${i === 1 ? "md:border-t-0" : ""}`}
              >
                <span aria-hidden className="grid size-8 place-items-center rounded-full bg-uva-surface-2 text-uva-text-muted">
                  <Icono className="size-4" />
                </span>
                <p className="m-0 min-w-0 text-uva-detalle text-uva-text-muted">
                  {evento.slug ? (
                    <Link href={`/admin/usuarios/${evento.slug}`} className="font-bold text-uva-text hover:underline">
                      {evento.nombre}
                    </Link>
                  ) : (
                    <span className="font-bold text-uva-text">{evento.nombre}</span>
                  )}{" "}
                  {evento.texto}
                  {evento.codigo && <span className="font-codigo text-uva-text"> {evento.codigo}</span>}
                </p>
                <time dateTime={evento.fecha} className="text-uva-detalle whitespace-nowrap text-uva-muted-2">
                  {tiempoRelativo(evento.fecha)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
