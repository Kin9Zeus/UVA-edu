import type { MetadataRoute } from "next";
import { createPublicClient } from "@/lib/supabase/public";
import { siteUrl } from "@/lib/site-url";

/**
 * P2-5 (AUDIT-2026-09-04.md): no existía ningún sitemap -- Google tenía que
 * descubrir cada curso navegando enlace por enlace desde el catálogo en vez
 * de encontrarlos de una en esta lista.
 *
 * Solo enumera lo que ya es público sin sesión: cursos con `mostrado =
 * true` (misma condición que "cursos_select_publicos" en
 * 030_acceso_curso_despublicado.sql, así que un curso oculto nunca aparece
 * acá aunque algún usuario con cortesía todavía pueda verlo) y categorías
 * `activo = true`. Las rutas de sesión (/dashboard, /admin, /vista-previa)
 * no tienen nada que hacer en un sitemap -- ver robots.ts.
 */
// Se publican cursos seguido desde /admin/cursos, entre despliegues de
// código que pueden estar días separados. Sin esto, la ruta queda estática
// (P2-4, AUDIT-2026-09-15) y se congela en el momento del build: un curso
// publicado después no aparecería acá hasta el próximo deploy. Una hora es
// suficiente para un sitemap -- no hace falta que Google se entere al
// segundo de un curso nuevo, y evita volver a pagar el round-trip a Supabase
// en cada visita del crawler.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  // P2-4 (AUDIT-2026-09-15): cliente público (Anon Key, sin cookies). Las dos
  // consultas ya filtran `mostrado`/`activo`, así que el resultado es el
  // mismo para todo el mundo — y un sitemap, por definición, es lo que ve un
  // crawler anónimo. Al no tocar `cookies()` esta ruta puede quedarse
  // estática: no renderiza scripts, así que el nonce de la CSP no le aplica
  // (a diferencia de la home, ver `(public)/page.tsx`).
  const supabase = createPublicClient();

  const [{ data: cursos }, { data: categorias }] = await Promise.all([
    supabase.from("cursos").select("slug, actualizado_en").eq("mostrado", true),
    supabase.from("categorias").select("slug").eq("activo", true),
  ]);

  const rutasEstaticas: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/catalogo`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/planes`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/registro`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/soporte`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const rutasCategorias: MetadataRoute.Sitemap = (categorias ?? []).map((categoria) => ({
    url: `${base}/catalogo/${categoria.slug}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const rutasCursos: MetadataRoute.Sitemap = (cursos ?? []).map((curso) => ({
    url: `${base}/cursos/${curso.slug}`,
    lastModified: curso.actualizado_en ?? undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...rutasEstaticas, ...rutasCategorias, ...rutasCursos];
}
