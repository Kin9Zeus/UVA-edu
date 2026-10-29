import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { logError } from "@/lib/log";
import { parsearBloques, type Bloque } from "@/lib/legal/bloques";
import { SLUGS_LEGALES, esSlugLegal, type SlugLegal } from "@/lib/legal/slugs";

/**
 * Lectura de los textos legales (tabla `textos_legales`, supabase/sql/130).
 *
 * Qué ve cada quien lo decide RLS, no este archivo: el visitante solo recibe
 * versiones PUBLICADAS cuya vigencia ya llegó; un administrador recibe
 * también borradores, y por eso la vista previa por versión usa el cliente de
 * SESIÓN y no el público.
 *
 * Caché: el texto vigente es igual para todo el mundo y cambia pocas veces al
 * año, así que se cachea como el catálogo (lib/cache-catalogo.ts). A
 * diferencia del catálogo, publicar es un script que corre fuera de Next y no
 * puede invalidar la etiqueta: la red de seguridad de `REVALIDAR_SEGUNDOS` es
 * aquí el mecanismo — una versión nueva tarda hasta 5 minutos en verse.
 */

export const TAG_TEXTOS_LEGALES = "textos-legales";
const REVALIDAR_SEGUNDOS = 300;

export type TextoLegal = {
  slug: SlugLegal;
  version: string;
  titulo: string;
  bloques: Bloque[];
  estado: "BORRADOR" | "PUBLICADO";
  /** ISO. Null solo en un borrador sin fecha. */
  vigenteDesde: string | null;
  publicadoEn: string | null;
};

const COLUMNAS = "slug, version, titulo, contenido, estado, vigente_desde, publicado_en";

type FilaTextoLegal = {
  slug: string;
  version: string;
  titulo: string;
  contenido: unknown;
  estado: string;
  vigente_desde: string | null;
  publicado_en: string | null;
};

function aTextoLegal(fila: FilaTextoLegal): TextoLegal {
  // El CHECK de la base solo deja pasar estos slugs; si algún día no coincide
  // con la lista del código, se falla a la vista y no se muestra a medias.
  if (!esSlugLegal(fila.slug)) {
    throw new Error(`textos_legales trae un slug desconocido: ${fila.slug}`);
  }
  return {
    slug: fila.slug,
    version: fila.version,
    titulo: fila.titulo,
    bloques: parsearBloques(fila.contenido),
    estado: fila.estado === "PUBLICADO" ? "PUBLICADO" : "BORRADOR",
    vigenteDesde: fila.vigente_desde,
    publicadoEn: fila.publicado_en,
  };
}

/**
 * La versión vigente de un texto: la PUBLICADA con `vigente_desde` más
 * reciente que ya haya llegado. `null` significa "no hay ninguna publicada" y
 * nada más (la página lo vuelve un 404); un ERROR de la consulta lanza,
 * igual que el catálogo, para que una caída de Supabase no se lea como "este
 * texto no existe".
 */
export const obtenerTextoVigente = unstable_cache(
  async (slug: SlugLegal): Promise<TextoLegal | null> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("textos_legales")
      .select(COLUMNAS)
      .eq("slug", slug)
      .eq("estado", "PUBLICADO")
      .lte("vigente_desde", new Date().toISOString())
      .order("vigente_desde", { ascending: false })
      .limit(1)
      .maybeSingle();
    lanzarSiFalla(error, `texto legal vigente (${slug})`);
    return data ? aTextoLegal(data) : null;
  },
  ["texto-legal-vigente"],
  { tags: [TAG_TEXTOS_LEGALES], revalidate: REVALIDAR_SEGUNDOS },
);

/**
 * Una versión concreta, borrador o publicada, para la vista previa del
 * administrador. Va con el cliente de sesión y SIN caché: RLS decide, y la
 * respuesta depende de quién pregunta. Para cualquiera que no sea
 * administrador un borrador no existe y la respuesta es `null`.
 */
export async function obtenerTextoPorVersion(
  slug: SlugLegal,
  version: string,
): Promise<TextoLegal | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("textos_legales")
    .select(COLUMNAS)
    .eq("slug", slug)
    .eq("version", version)
    .maybeSingle();
  lanzarSiFalla(error, `texto legal ${slug} versión ${version}`);
  return data ? aTextoLegal(data) : null;
}

const slugsConTextoVigenteCacheados = unstable_cache(
  async (): Promise<SlugLegal[]> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("textos_legales")
      .select("slug")
      .eq("estado", "PUBLICADO")
      .lte("vigente_desde", new Date().toISOString());
    lanzarSiFalla(error, "textos legales publicados");
    const publicados = new Set((data ?? []).map((fila) => fila.slug));
    // En el orden fijo de SLUGS_LEGALES, no en el que devuelva la base.
    return SLUGS_LEGALES.filter((slug) => publicados.has(slug));
  },
  ["textos-legales-publicados"],
  { tags: [TAG_TEXTOS_LEGALES], revalidate: REVALIDAR_SEGUNDOS },
);

/**
 * Qué textos tienen una versión vigente, para no enlazar nunca una página que
 * daría 404 (el pie y el mapa del sitio). Es un dato secundario: ante un
 * fallo la página sigue sin esos enlaces, pero el fallo se REGISTRA — nunca
 * en silencio (CLAUDE.md §3.2).
 */
export async function getSlugsConTextoVigente(): Promise<SlugLegal[]> {
  try {
    return await slugsConTextoVigenteCacheados();
  } catch (error) {
    unstable_rethrow(error);
    logError("legal:publicados", "no se pudo saber qué textos legales hay publicados", error, { area: "legal" });
    return [];
  }
}
