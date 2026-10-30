import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { TextoLegal } from "@/components/legal/TextoLegal";
import { getPerfilActual } from "@/lib/perfil";
import { metadataPublica } from "@/lib/seo/metadata";
import { corchetesSinResolver, indiceDeBloques } from "@/lib/legal/bloques";
import {
  DESCRIPCION_LEGAL,
  NOMBRE_LEGAL,
  esSlugLegal,
  rutaLegal,
} from "@/lib/legal/slugs";
import { obtenerTextoPorVersion, obtenerTextoVigente } from "@/lib/legal/textos";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ version?: string | string[] }>;
};

/** `?version=` solo vale como texto: un valor repetido (`?version=a&version=b`) no es una versión. */
function versionSolicitada(valor: string | string[] | undefined): string | undefined {
  return typeof valor === "string" && valor.length > 0 ? valor : undefined;
}

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "long",
  timeZone: "America/Bogota",
});

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!esSlugLegal(slug)) return {};
  const version = versionSolicitada((await searchParams).version);
  return metadataPublica({
    titulo: NOMBRE_LEGAL[slug],
    descripcion: DESCRIPCION_LEGAL[slug],
    ruta: rutaLegal(slug),
    // Una vista previa por versión no es el texto vigente: no se indexa.
    indexable: !version,
  });
}

/**
 * Un texto legal público. Sin `?version=` muestra el vigente (el que ven
 * todos); con `?version=` muestra esa versión, borrador o no, pero solo a un
 * administrador: es RLS quien lo decide (lib/legal/textos.ts), para cualquier
 * otra persona esa versión no existe y la respuesta es un 404 igual que si
 * no hubiera ninguna publicada.
 */
export default async function TextoLegalPage({ params, searchParams }: Props) {
  const { slug } = await params;
  if (!esSlugLegal(slug)) notFound();
  const version = versionSolicitada((await searchParams).version);

  const [perfilActual, texto] = await Promise.all([
    getPerfilActual(),
    version ? obtenerTextoPorVersion(slug, version) : obtenerTextoVigente(slug),
  ]);
  if (!texto) notFound();

  const secciones = indiceDeBloques(texto.bloques).filter((entrada) => entrada.nivel === 2);
  const esBorrador = texto.estado === "BORRADOR";
  const aunNoRige = !esBorrador && texto.vigenteDesde !== null && new Date(texto.vigenteDesde) > new Date();
  const pendientes = esBorrador ? corchetesSinResolver(texto.bloques, texto.titulo) : [];

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main id="contenido" tabIndex={-1}>
        <article className="mx-auto flex w-full max-w-[820px] flex-col gap-5 px-uva-margen pt-10 pb-uva-seccion sm:pt-14">
          <header className="flex flex-col gap-2">
            <h1 className="text-uva-titulo-2 text-balance text-uva-text">{texto.titulo}</h1>
            <p className="text-uva-detalle text-uva-text-muted">
              Versión {texto.version}.{" "}
              {texto.vigenteDesde
                ? `Vigente desde el ${formatoFecha.format(new Date(texto.vigenteDesde))}.`
                : "Sin fecha de vigencia todavía."}
            </p>
          </header>

          {/* Solo lo ve un administrador (RLS): el visitante nunca llega a un
              borrador ni a una versión con vigencia futura. */}
          {esBorrador && (
            <div
              role="note"
              className="rounded-uva-md border border-uva-line-strong bg-uva-surface p-4 text-uva-detalle text-uva-text print:hidden"
            >
              <p className="font-bold">Borrador: no está publicado.</p>
              <p>Lo ves porque eres administrador. Nadie más puede abrir esta versión.</p>
              {pendientes.length > 0 && (
                <p className="mt-2 wrap-anywhere">
                  Faltan {pendientes.length} {pendientes.length === 1 ? "dato" : "datos"} por completar
                  antes de poder publicarlo: {pendientes.join(", ")}.
                </p>
              )}
            </div>
          )}
          {aunNoRige && texto.vigenteDesde && (
            <div
              role="note"
              className="rounded-uva-md border border-uva-line-strong bg-uva-surface p-4 text-uva-detalle text-uva-text print:hidden"
            >
              <p className="font-bold">Esta versión todavía no rige.</p>
              <p>
                Empieza el {formatoFecha.format(new Date(texto.vigenteDesde))}. Hasta entonces los
                visitantes ven la versión anterior.
              </p>
            </div>
          )}

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
