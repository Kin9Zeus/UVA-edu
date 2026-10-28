import type { CSSProperties } from "react";
import { Cifra } from "@/components/admin/GraficaSemanas";
import { EstadoEnCatalogo, seVeEnCatalogo } from "@/components/admin/categorias/EstadoEnCatalogo";
import { DIAS_ESTUDIO_CATEGORIAS, type ResumenCategorias as Resumen } from "@/lib/admin/categorias";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/**
 * Barras horizontales, una por categoría: las categorías se comparan entre
 * sí, no en el tiempo, y un nombre largo se lee sin girarlo. Es una lista con
 * el número escrito al lado, así que no necesita detalle al pasar el mouse.
 */
function DondeEstudian({ categorias }: { categorias: Resumen["categorias"] }) {
  const orden = [...categorias].sort((a, b) => b.personas - a.personas || a.nombre.localeCompare(b.nombre));
  const maximo = Math.max(0, ...orden.map((c) => c.personas));

  if (maximo === 0) {
    return (
      <div className="grid justify-items-center gap-1 px-3 py-7 text-center">
        <p className="m-0 font-bold text-uva-text">Nadie ha estudiado en los últimos {DIAS_ESTUDIO_CATEGORIAS} días</p>
        <p className="m-0 max-w-[42ch] text-uva-detalle text-uva-text-muted">Cuando alguien vea una clase, aquí sale en qué categoría.</p>
      </div>
    );
  }

  return (
    <>
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {orden.map((categoria) => (
          <li key={categoria.id} className="grid gap-x-4 gap-y-1 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-center">
            <span className="flex min-w-0 items-center gap-2 text-uva-detalle font-semibold text-uva-text" title={categoria.nombre}>
              <span className="min-w-0 truncate">{categoria.nombre}</span>
              {!seVeEnCatalogo(categoria) && <EstadoEnCatalogo categoria={categoria} />}
            </span>
            <span className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                style={{ "--ancho": `${(categoria.personas / maximo) * 100}%` } as CSSProperties}
                className={
                  categoria.personas > 0
                    ? "h-4.5 w-[calc(var(--ancho)*0.5)] shrink-0 rounded-r-uva-xs bg-uva-serie-1 md:w-[calc(var(--ancho)*0.72)]"
                    : "h-4.5 w-0.5 shrink-0 bg-uva-line-strong"
                }
              />
              <span className="min-w-0 text-uva-detalle text-uva-text-muted">
                <span className="font-mono font-bold text-uva-text">{categoria.personas}</span>{" "}
                {categoria.personas === 1 ? "persona" : "personas"}
                {categoria.certificados > 0 && (
                  <span className="max-md:block">
                    <span className="max-md:hidden">, </span>
                    {plural(categoria.certificados, "certificado", "certificados")}
                  </span>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="m-0 mt-3 text-uva-detalle text-uva-text-muted">Una persona que estudia en dos categorías cuenta en las dos.</p>
    </>
  );
}

export function ResumenCategorias({ resumen }: { resumen: Resumen }) {
  const { categorias } = resumen;
  const seVen = categorias.filter(seVeEnCatalogo).length;
  const noSeVen = categorias.filter((c) => c.activo && c.publicados === 0).length;
  const apagadas = categorias.filter((c) => !c.activo).length;

  return (
    <section aria-labelledby="categorias-resumen" className="rounded-uva-lg border border-uva-divider bg-uva-surface">
      <div className="min-w-0 border-b border-uva-divider p-4 sm:p-5 lg:px-6">
        <h2 id="categorias-resumen" className="mb-3 text-uva-cuerpo font-extrabold text-uva-text">
          Dónde estudió la gente en los últimos {DIAS_ESTUDIO_CATEGORIAS} días
        </h2>
        <DondeEstudian categorias={categorias} />
      </div>
      <dl className="grid grid-cols-2 lg:grid-cols-4">
        <Cifra
          enFila
          valor={`${seVen} de ${categorias.length}`}
          etiqueta="se ven en el catálogo"
          nota={
            noSeVen > 0
              ? `${plural(noSeVen, "encendida no se ve", "encendidas no se ven")}: sin cursos publicados`
              : apagadas > 0
                ? plural(apagadas, "apagada", "apagadas")
                : "Todas"
          }
          alerta={noSeVen > 0}
        />
        <Cifra
          enFila
          valor={String(resumen.cursosPublicados)}
          etiqueta={resumen.cursosPublicados === 1 ? "curso publicado" : "cursos publicados"}
          nota={`${resumen.cursosBorrador} en borrador`}
        />
        <Cifra
          enFila
          valor={String(resumen.personas)}
          etiqueta={resumen.personas === 1 ? "persona estudió" : "personas estudiaron"}
          nota={`En los últimos ${DIAS_ESTUDIO_CATEGORIAS} días, sin repetir`}
        />
        <Cifra
          enFila
          valor={String(resumen.certificados)}
          etiqueta={resumen.certificados === 1 ? "certificado" : "certificados"}
          nota={`Emitidos en los últimos ${DIAS_ESTUDIO_CATEGORIAS} días`}
        />
      </dl>
    </section>
  );
}
