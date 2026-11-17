import type { SupabaseClient } from "@supabase/supabase-js";
import { lanzarSiFalla } from "@/lib/supabase/errores";

const TABLAS = {
  cursos: { historial: "cursos_slugs_anteriores", columnaId: "id_curso" },
  categorias: { historial: "categorias_slugs_anteriores", columnaId: "id_categoria" },
} as const;

/**
 * Slugs que empiezan por `base` y ya no se pueden usar: los actuales de
 * otros cursos (o escuelas) y los que tuvieron antes (historial de
 * supabase/sql/137_slugs_anteriores.sql). Un slug viejo queda reservado para
 * siempre: si otro curso lo tomara, los enlaces guardados al primero
 * llevarían al curso equivocado en vez de redirigir.
 *
 * `exceptoId` excluye a la propia entidad al editar: reguardar sin cambiar el
 * título no le suma un sufijo, y volver a un título anterior recupera su
 * slug viejo (el trigger lo saca del historial).
 *
 * Un fallo lanza: tratarlo como «nada tomado» elegiría un slug ocupado.
 */
export async function slugsOcupados(
  supabase: SupabaseClient,
  tabla: keyof typeof TABLAS,
  base: string,
  exceptoId?: string,
): Promise<string[]> {
  const { historial, columnaId } = TABLAS[tabla];

  let actuales = supabase.from(tabla).select("slug").like("slug", `${base}%`);
  let anteriores = supabase.from(historial).select("slug").like("slug", `${base}%`);
  if (exceptoId) {
    actuales = actuales.neq("id", exceptoId);
    anteriores = anteriores.neq(columnaId, exceptoId);
  }

  const [rActuales, rAnteriores] = await Promise.all([actuales, anteriores]);
  lanzarSiFalla(rActuales.error, `admin/${tabla}:slugs actuales`);
  lanzarSiFalla(rAnteriores.error, `admin/${tabla}:slugs anteriores`);

  return [...(rActuales.data ?? []), ...(rAnteriores.data ?? [])].map((fila) => fila.slug as string);
}
