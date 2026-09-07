import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
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
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const supabase = await createClient();

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
