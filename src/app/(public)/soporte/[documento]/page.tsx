import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { IndiceLegal } from "@/components/soporte/IndiceLegal";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { DOCUMENTOS_LEGALES, esDocumentoLegal } from "@/content/legal";
import { getPerfilActual } from "@/lib/perfil";
import { metadataPublica } from "@/lib/seo/metadata";

const FOCO = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-uva-accent";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ documento: string }>;
}): Promise<Metadata> {
  const { documento } = await params;
  if (!esDocumentoLegal(documento)) return {};
  const { titulo, descripcion, secciones } = DOCUMENTOS_LEGALES[documento];
  // En preparación no hay nada que indexar.
  return metadataPublica({ titulo, descripcion, ruta: `/soporte/${documento}`, indexable: secciones.length > 0 });
}

/**
 * Términos y Privacidad, una página de lectura cada uno: columna de 68
 * caracteres como máximo e índice de cláusulas (desplegable en celular, fijo a
 * la derecha desde 1024 px). El contenido vive en src/content/legal.tsx.
 */
export default async function DocumentoLegalPage({ params }: { params: Promise<{ documento: string }> }) {
  const { documento } = await params;
  if (!esDocumentoLegal(documento)) notFound();
  const { titulo, actualizado, secciones } = DOCUMENTOS_LEGALES[documento];
  const perfilActual = await getPerfilActual();

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main id="contenido" tabIndex={-1}>
        <div className="mx-auto grid w-full max-w-[1120px] gap-7 px-uva-margen pt-10 pb-uva-seccion sm:pt-14 lg:grid-cols-[minmax(0,68ch)_15rem] lg:justify-between lg:gap-x-12">
          <div className="grid gap-3 lg:col-span-2">
            <Link
              href="/soporte"
              className={`-ml-1 inline-flex min-h-11 w-fit items-center gap-1 rounded-uva-xs pr-1 text-uva-cuerpo font-semibold text-uva-accent-ink hover:underline ${FOCO}`}
            >
              <ChevronLeft aria-hidden="true" className="size-5" strokeWidth={2} />
              Soporte
            </Link>
            <h1 className="text-uva-titulo-2 text-balance text-uva-text">{titulo}</h1>
            {actualizado && <p className="text-uva-detalle text-uva-text-muted">Última actualización: {actualizado}</p>}
          </div>

          {secciones.length === 0 ? (
            <EstadoVacio
              className="lg:col-span-2 lg:max-w-[68ch]"
              titulo="Este documento está en preparación"
              texto="Lo publicaremos aquí cuando esté listo. Si mientras tanto tienes una pregunta sobre tus datos o las condiciones de uso, escríbenos."
              accion={{ etiqueta: "Ir a Contacto", href: "/soporte#contacto" }}
            />
          ) : (
            <>
              <article className="grid min-w-0 gap-8 text-uva-cuerpo leading-relaxed text-uva-text-muted [&_li]:mt-2 [&_p+p]:mt-3 [&_strong]:text-uva-text [&_ul]:list-disc [&_ul]:pl-5">
                <details className="group rounded-uva-md border-[1.5px] border-uva-line-strong lg:hidden">
                  <summary
                    className={`flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-uva-md px-4 font-semibold text-uva-text [&::-webkit-details-marker]:hidden ${FOCO}`}
                  >
                    En esta página
                    <ChevronDown
                      aria-hidden="true"
                      className="size-[18px] text-uva-text-muted transition-transform group-open:rotate-180 motion-reduce:transition-none"
                      strokeWidth={2}
                    />
                  </summary>
                  <ol className="grid border-t border-uva-divider px-4 py-2">
                    {secciones.map(({ id, titulo: tituloSeccion }, i) => (
                      <li key={id} className="!mt-0">
                        <a
                          href={`#${id}`}
                          className={`flex min-h-11 items-center gap-2 rounded-uva-xs text-uva-text-muted hover:text-uva-text ${FOCO}`}
                        >
                          <span className="min-w-[1.4em] tabular-nums">{i + 1}</span>
                          {tituloSeccion}
                        </a>
                      </li>
                    ))}
                  </ol>
                </details>

                {secciones.map(({ id, titulo: tituloSeccion, contenido }, i) => (
                  <section key={id} aria-labelledby={id}>
                    <h2 id={id} className="mb-2 scroll-mt-24 text-uva-titulo-4 text-uva-text">
                      {i + 1}. {tituloSeccion}
                    </h2>
                    {contenido}
                  </section>
                ))}
              </article>
              <IndiceLegal secciones={secciones.map(({ id, titulo: tituloSeccion }) => ({ id, titulo: tituloSeccion }))} />
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
