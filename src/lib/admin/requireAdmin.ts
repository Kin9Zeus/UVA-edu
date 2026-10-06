import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";

/**
 * Guard para Server Actions del panel admin. RLS ya bloquea en la base de
 * datos cualquier mutación de un no-administrador (private.es_administrador(),
 * ver supabase/sql/00{1,2,3,4}_*.sql), pero esta verificación evita el
 * roundtrip innecesario y da un mensaje de error legible en vez de que la
 * query falle silenciosamente por RLS.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const user = await getUsuarioActual();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." } as const;
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  // Falla CERRADO (no se concede nada), pero un fallo de la base no es "no
  // tienes permisos": a un administrador de verdad se le dice que reintente.
  // PGRST116 (cero filas) sí es "no hay perfil", o sea, sin permisos.
  if (errorPerfil && errorPerfil.code !== "PGRST116") {
    return { error: "No pudimos comprobar tus permisos. Intenta de nuevo." } as const;
  }

  if (perfil?.rol !== "ADMINISTRADOR") {
    return { error: "No tienes permisos de administrador." } as const;
  }

  return { supabase, adminId: user.id } as const;
}
