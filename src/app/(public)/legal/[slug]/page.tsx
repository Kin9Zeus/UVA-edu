import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { TextoLegal } from "@/components/legal/TextoLegal";
import { getPerfilActual } from "@/lib/perfil";
import { metadataPublica } from "@/lib/seo/metadata";
import { indiceDeBloques } from "@/lib/legal/bloques";
import {
  DESCRIPCION_LEGAL,
  NOMBRE_LEGAL,
  esSlugLegal,
  rutaLegal,
} from "@/lib/legal/slugs";
import { obtenerTextoVigente } from "@/lib/legal/textos";

type Props = {
  params: Promise<{ slug: string }>;
};

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeZone: "America/Bogota",
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!esSlugLegal(slug)) return {};
  return metadataPublica({
    titulo: NOMBRE_LEGAL[slug],
    descripcion: DESCRIPCION_LEGAL[slug],
    ruta: rutaLegal(slug),
  });
}

/** Un texto legal público: la versión vigente (src/content/legal). */
export default async function TextoLegalPage({ params }: Props) {
  const { slug } = await params;
  if (!esSlugLegal(slug)) notFound();
  const texto = obtenerTextoVigente(slug);
  if (!texto) notFound();

  const perfilActual = await getPerfilActual();
  const secciones = indiceDeBloques(texto.bloques).filter((entrada) => entrada.nivel === 2);

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main id="contenido" tabIndex={-1}>
        <article className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-uva-margen pt-10 pb-uva-seccion sm:pt-14">
          <header className="flex flex-col gap-2">
            <h1 className="text-uva-titulo-2 text-balance text-uva-text">{texto.titulo}</h1>
            <p className="text-uva-detalle text-uva-text-muted">
              Versión {texto.version}. Vigente desde el{" "}
              {formatoFecha.format(new Date(`${texto.vigenteDesde}T12:00:00-05:00`))}.
            </p>
          </header>

          {secciones.length >= 5 && (
            <nav aria-label="Secciones de este texto" className="print:hidden">
              <details className="rounded-uva-md border border-uva-line-strong bg-uva-surface">
                <summary className="flex min-h-11 cursor-pointer items-center px-4 text-uva-cuerpo font-bold text-uva-text focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-uva-accent">
                  Ir a una sección ({secciones.length})
                </summary>
                <ol className="flex flex-col px-4 pb-3">
                  {secciones.map((entrada) => (
                    <li key={entrada.id}>
                      <a
                        href={`#${entrada.id}`}
                        className="flex min-h-11 items-center text-uva-cuerpo text-uva-accent-ink underline underline-offset-3 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent"
                      >
                        {entrada.texto}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            </nav>
          )}

          <TextoLegal bloques={texto.bloques} />
        </article>
      </main>
      <Footer />
    </>
  );
}
