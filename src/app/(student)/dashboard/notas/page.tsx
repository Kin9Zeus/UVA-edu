import type { Metadata } from "next";
import { getPerfilActual } from "@/lib/perfil";
import { getMisNotas } from "@/lib/notas";
import { createClient } from "@/lib/supabase/server";
import { registrarSiFalla } from "@/lib/supabase/registrar";
import { MisNotasContent } from "@/components/dashboard/MisNotasContent";

export const metadata: Metadata = { title: "U.V.A. — Mis notas" };

/**
 * Todas las notas privadas del estudiante (docs/notas-leccion.md §6.6).
 * Vive en el dashboard, fuera del muro de pago: con la suscripción vencida
 * el reproductor ya no abre, y esta es la única forma de volver a los
 * apuntes propios.
 *
 * `?curso=<slug>`: solo las notas de ese curso ("Mis notas del curso" en la
 * ficha), con un enlace para ver todas.
 */
export default async function MisNotasPage({
  searchParams,
}: {
  searchParams: Promise<{ curso?: string | string[] }>;
}) {
  const { user } = await getPerfilActual();
  const parametro = (await searchParams).curso;
  const slugCurso = typeof parametro === "string" && parametro.trim() ? parametro.trim() : null;

  const supabase = await createClient();
  const [misNotas, cursoFiltro] = await Promise.all([
    getMisNotas(user!.id),
    slugCurso
      ? supabase.from("cursos").select("slug, titulo").eq("slug", slugCurso).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // El filtro es secundario: si no se puede leer el curso, se muestran todas
  // las notas (nada se esconde) y el fallo queda registrado.
  registrarSiFalla(cursoFiltro.error, "notas:filtro-curso", "no se pudo leer el curso del filtro", { slugCurso });

  return <MisNotasContent {...misNotas} filtro={cursoFiltro.data ?? null} />;
}
