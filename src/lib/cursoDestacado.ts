import { createClient } from "@/lib/supabase/server";

export type CursoDestacado = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  imagenPortada: string;
  nivel: "BASICO" | "INTERMEDIO" | "AVANZADO";
  totalClases: number;
  duracionTotalSegundos: number;
};

/**
 * El curso que el admin marcó `destacado` (ConfiguracionTab.tsx) y que sigue
 * `mostrado`. El switch no es exclusivo — nada impide marcar dos a la vez —
 * así que ante varios se toma el de menor `orden_visualizacion`, el mismo
 * criterio de desempate que ya usa `buscar_catalogo`
 * (supabase/sql/034_busqueda_catalogo.sql). Sin ninguno marcado, `null`: la
 * landing y el dashboard ocultan la sección en vez de mostrar algo vacío.
 *
 * `totalClases`/`duracionTotalSegundos` cuentan TODAS las lecciones del
 * curso, sin filtrar por `estado_procesamiento`, a propósito: es el mismo
 * criterio que ya usa `buscar_catalogo` para `total_clases` (034) — si
 * filtráramos acá por "LISTO" el número mostrado en esta sección no
 * coincidiría con el que ya ve el mismo curso en la tarjeta del catálogo.
 */
export async function getCursoDestacado(): Promise<CursoDestacado | null> {
  const supabase = await createClient();

  const { data: curso } = await supabase
    .from("cursos")
    .select("id, slug, titulo, descripcion, imagen_portada, nivel")
    .eq("destacado", true)
    .eq("mostrado", true)
    .order("orden_visualizacion", { ascending: true })
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!curso) return null;

  const { data: moduloRows } = await supabase
    .from("modulos")
    .select("lecciones(duracion)")
    .eq("id_curso", curso.id);

  const lecciones = (moduloRows ?? []).flatMap((modulo) => modulo.lecciones ?? []);

  return {
    id: curso.id as string,
    slug: curso.slug as string,
    titulo: curso.titulo as string,
    descripcion: curso.descripcion as string,
    imagenPortada: curso.imagen_portada as string,
    nivel: curso.nivel as CursoDestacado["nivel"],
    totalClases: lecciones.length,
    duracionTotalSegundos: lecciones.reduce((total, leccion) => total + ((leccion.duracion as number | null) ?? 0), 0),
  };
}
