import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { createPublicClient } from "@/lib/supabase/public";
import { logError } from "@/lib/log";
import { lanzarSiFalla } from "@/lib/supabase/errores";
import { REVALIDAR_SEGUNDOS, TAG_CATALOGO, TAG_CATEGORIAS } from "@/lib/cache-catalogo";
import { CIFRAS_VERIFICABLES, MINIMOS_CIFRAS, type Cifra } from "@/content/marketing";

export type ConteosPublicos = { cursosPublicados: number; escuelasConCursos: number };

const formatoNumero = new Intl.NumberFormat("es-CO");

/**
 * Arma las cifras que se pueden mostrar: primero las verificables escritas a
 * mano en `content/marketing.ts`, después las contadas desde la base que
 * pasan su mínimo. Separada de la consulta para probarla sin Supabase.
 */
export function armarCifras(conteos: ConteosPublicos | null): Cifra[] {
  const cifras: Cifra[] = [...CIFRAS_VERIFICABLES];
  if (!conteos) return cifras;

  const { cursosPublicados, escuelasConCursos } = conteos;
  if (cursosPublicados >= MINIMOS_CIFRAS.cursosPublicados) {
    cifras.push({
      valor: formatoNumero.format(cursosPublicados),
      etiqueta: cursosPublicados === 1 ? "curso publicado" : "cursos publicados",
    });
  }
  if (escuelasConCursos >= MINIMOS_CIFRAS.escuelasConCursos) {
    cifras.push({
      valor: formatoNumero.format(escuelasConCursos),
      etiqueta: escuelasConCursos === 1 ? "escuela" : "escuelas",
    });
  }
  return cifras;
}

/**
 * Cursos publicados (`mostrado`) y escuelas (categorías activas) que tienen
 * al menos uno. Una sola consulta con el cliente público: RLS ya deja fuera
 * los cursos ocultos y, en el embed, las categorías inactivas (llegan como
 * `null`).
 */
const conteosCacheados = unstable_cache(
  async (): Promise<ConteosPublicos> => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("cursos")
      .select("id, curso_categorias(categoria:categorias(id))")
      .eq("mostrado", true);
    lanzarSiFalla(error, "cifras públicas");

    const cursos = data ?? [];
    const escuelas = new Set<string>();
    for (const curso of cursos) {
      for (const relacion of curso.curso_categorias ?? []) {
        const categoria = relacion.categoria as unknown as { id: string } | null;
        if (categoria) escuelas.add(categoria.id);
      }
    }
    return { cursosPublicados: cursos.length, escuelasConCursos: escuelas.size };
  },
  ["cifras-publicas"],
  { tags: [TAG_CATALOGO, TAG_CATEGORIAS], revalidate: REVALIDAR_SEGUNDOS },
);

/**
 * Las cifras para la portada y el login. Ante un fallo de la base se quedan
 * solo las verificables (o ninguna): el bloque se oculta en vez de mostrar
 * una cifra vacía.
 */
export async function getCifrasPublicas(): Promise<Cifra[]> {
  try {
    return armarCifras(await conteosCacheados());
  } catch (error) {
    unstable_rethrow(error);
    logError("marketing:cifras", "no se pudieron contar las cifras públicas", error, { area: "catalogo" });
    return armarCifras(null);
  }
}
