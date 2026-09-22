import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { Footer } from "@/components/home/Footer";
import { getPerfilActual } from "@/lib/perfil";
import { resolverCategoria, buscarCatalogoPublico, getCursosParaBuscador } from "@/lib/categoria";
import { CatalogoContent } from "@/components/catalogo/CatalogoContent";
import { esUuid } from "@/lib/slug";
import { metadataPublica } from "@/lib/seo/metadata";
import { numeroDePagina, textoDeBusqueda, type ParametroUrl } from "@/lib/parametros-url";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categoriaSlug: string }>;
}): Promise<Metadata> {
  const { categoriaSlug } = await params;
  const categoria = await resolverCategoria(categoriaSlug);

  if (!categoria) {
    // La página hará notFound(); esto solo evita anunciar un canonical a una
    // ruta que devuelve 404.
    return { title: "U.V.A. — Categoría" };
  }

  // El canonical apunta SIEMPRE al slug, nunca al uuid con el que se pudo
  // llegar: `resolverCategoria` acepta los dos (enlaces anteriores al cambio
  // de rutas), así que sin esto la misma lista vive en dos direcciones y
  // Google las ve como contenido duplicado. Mismo criterio que la ficha de
  // curso, que ya lo hacía.
  return metadataPublica({
    titulo: categoria.nombre,
    descripcion: `Cursos de ${categoria.nombre.toLowerCase()} en U.V.A: formación técnica para el oficio de la construcción.`,
    ruta: `/catalogo/${categoria.slug}`,
  });
}

export default async function CategoriaPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoriaSlug: string }>;
  // Tipo real (un parámetro repetido llega como arreglo): ver lib/parametros-url.ts.
  searchParams: Promise<{ q?: ParametroUrl; page?: ParametroUrl }>;
}) {
  const { categoriaSlug } = await params;
  const parametros = await searchParams;
  const q = textoDeBusqueda(parametros.q);
  const pagina = numeroDePagina(parametros.page);
  // Solo se lleva `page` al redirect de abajo si la URL la traía.
  const page = parametros.page === undefined ? undefined : String(pagina);
  // resolverCategoria acepta slug o UUID, así que los enlaces anteriores al
  // cambio de rutas siguen resolviendo. En paralelo con getPerfilActual():
  // son dos consultas independientes que antes iban en cascada.
  const [perfilActual, categoria] = await Promise.all([getPerfilActual(), resolverCategoria(categoriaSlug)]);

  if (!categoria) {
    notFound();
  }

  // Enlace viejo con UUID: misma página con slug, conservando la búsqueda y
  // la página. Motivo del 307 en /cursos/[cursoSlug]/page.tsx.
  if (esUuid(categoriaSlug)) {
    const consulta = new URLSearchParams({ ...(q ? { q } : {}), ...(page ? { page } : {}) }).toString();
    redirect(`/catalogo/${categoria.slug}${consulta ? `?${consulta}` : ""}`);
  }

  const [resultado, opcionesBusqueda] = await Promise.all([
    buscarCatalogoPublico({ query: q, categoriaId: categoria.id, pagina }),
    getCursosParaBuscador(),
  ]);

  return (
    <>
      <SiteHeader {...perfilActual} />
      <main>
        <CatalogoContent
          categorias={[]}
          resultado={resultado}
          opcionesBusqueda={opcionesBusqueda}
          categoriaFija={categoria}
        />
      </main>
      <Footer />
    </>
  );
}
