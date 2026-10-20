import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCifrasPublicas } from "@/lib/cifrasPublicas";
import type { CategoriaActiva } from "@/lib/categoria";
import { MaquetaCategorias } from "@/components/home/MaquetaCategorias";

const TITULO_SIN_REMATE = "La escuela del sector de la";
const REMATE_TITULO = "construcción";
export const TITULO_PORTADA = `${TITULO_SIN_REMATE} ${REMATE_TITULO}`;
export const DESCRIPCION_PORTADA =
  "Del primer boceto a la entrega final: diseño, modelado, presupuesto, contratación y gestión de obra.";

export async function Hero({
  hrefCodigo,
  categorias,
}: {
  hrefCodigo: string;
  categorias: CategoriaActiva[];
}) {
  // Sin cifras que pasen su mínimo (content/marketing.ts), la fila no se
  // renderiza: nunca una cifra inventada ni un número vacío.
  const cifras = await getCifrasPublicas();

  // En celular el orden es título, maqueta (a color, con rótulos) y botones
  // uno debajo del otro. Desde lg, dos columnas: título, párrafo y botones a
  // la izquierda; la maqueta ocupa la columna derecha en las dos filas.
  return (
    <section className="mx-auto grid w-full max-w-uva px-uva-margen pt-7 pb-14 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-x-10 lg:pt-10 lg:pb-[72px]">
      <h1 className="relative z-[1] text-uva-display text-uva-text lg:col-start-1 lg:row-start-1 lg:mb-7 lg:max-w-[8.6em] lg:self-end">
        {TITULO_SIN_REMATE} <span className="text-uva-accent-ink">{REMATE_TITULO}</span>
      </h1>

      {/* En celular y tablet la maqueta se ajusta al alto visible (es casi
          cuadrada) para que título, maqueta y los dos botones quepan en la
          primera pantalla; nunca baja de 240 px, donde los rótulos dejarían
          de leerse. En celular girado (`apaisado`) mide 300 px: con 240 el
          nombre más largo ("Construcción") no cabe en su rótulo. */}
      <div className="mx-auto mt-4 mb-3 w-full max-[359px]:mt-6 max-w-[min(100%,max(240px,calc(100svh-400px)))] sm:mt-4 sm:mb-6 sm:max-w-[min(560px,max(240px,calc(100svh-330px)))] apaisado:max-lg:max-w-[300px] lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:my-0 lg:max-w-none lg:self-center">
        <MaquetaCategorias categorias={categorias} />
      </div>

      <div className="min-w-0 lg:col-start-1 lg:row-start-2 lg:self-start">
        <p className="mb-9 hidden max-w-[28em] text-uva-lead text-uva-text-muted lg:block">
          {DESCRIPCION_PORTADA} Clases cortas, plantillas listas para usar y casos reales.
        </p>

        <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3.5">
          <Button
            render={<Link href={hrefCodigo} />}
            nativeButton={false}
            variant="uva-primary"
            size="uva"
            className="min-h-[50px] text-uva-cuerpo sm:min-h-13 sm:w-auto sm:px-[26px]"
          >
            Tengo un código
          </Button>
          <Button
            render={<Link href="/catalogo" />}
            nativeButton={false}
            variant="uva-secondary"
            size="uva"
            className="min-h-[50px] text-uva-cuerpo sm:min-h-13 sm:w-auto sm:px-[26px]"
          >
            Explorar cursos
          </Button>
        </div>

        {cifras.length > 0 && (
          <dl className="mt-9 flex flex-wrap gap-x-12 gap-y-6">
            {cifras.map((cifra) => (
              <div key={cifra.etiqueta} className="flex flex-col-reverse">
                <dt className="mt-1 text-uva-detalle text-uva-text-muted">{cifra.etiqueta}</dt>
                <dd className="font-mono text-uva-titulo-3 text-uva-text">{cifra.valor}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
