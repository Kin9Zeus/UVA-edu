import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de solo lectura con la Anon Key, sin sesión ni cookies.
 *
 * Para datos públicos del catálogo que se leen desde Server Components y no
 * dependen de quién esté mirando (planes activos, categorías). Al no tocar
 * cookies evita volver dinámica la request por una consulta que es igual
 * para todo el mundo.
 *
 * Respeta RLS: solo devuelve lo que las políticas de `SELECT` público
 * permiten (`planes_select_publico`, `categorias_select_publico`,
 * `cursos_select_publicos`). Para leer datos del usuario autenticado usa
 * `@/lib/supabase/server`, que sí propaga la sesión.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
