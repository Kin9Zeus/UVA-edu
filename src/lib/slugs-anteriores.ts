import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { esUuid } from "@/lib/slug";

const HISTORIAL = {
  cursos: { tabla: "cursos_slugs_anteriores", destino: "cursos" },
  categorias: { tabla: "categorias_slugs_anteriores", destino: "categorias" },
} as const;

/**
 * Slug actual del curso (o escuela) que antes se llamaba `slugViejo`, o null
 * si nunca existió. Lo usan las páginas públicas antes de responder 404:
 * con un slug viejo redirigen con 308 a la URL actual (SEO fase 14, tarea de
 * migración, paso 7; historial en supabase/sql/137_slugs_anteriores.sql).
 *
 * Con el cliente de la sesión, así que RLS decide: un curso oculto solo
 * redirige para quien lo puede ver, igual que su ficha.
 */
export async function slugActual(tipo: keyof typeof HISTORIAL, slugViejo: string): Promise<string | null> {
  if (esUuid(slugViejo)) return null;

  const { tabla, destino } = HISTORIAL[tipo];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(tabla)
    .select(`actual:${destino}(slug)`)
    .eq("slug", slugViejo)
    .maybeSingle();

  lanzarSiFalla(error, `slugActual:${tabla}`);
  const actual = data?.actual as { slug: string } | { slug: string }[] | null | undefined;
  return (Array.isArray(actual) ? actual[0]?.slug : actual?.slug) ?? null;
}
