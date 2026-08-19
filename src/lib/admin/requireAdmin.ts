import { createClient } from "@/lib/supabase/server";

/**
 * Guard para Server Actions del panel admin. RLS ya bloquea en la base de
 * datos cualquier mutación de un no-administrador (private.es_administrador(),
 * ver supabase/sql/00{1,2,3,4}_*.sql), pero esta verificación evita el
 * roundtrip innecesario y da un mensaje de error legible en vez de que la
 * query falle silenciosamente por RLS.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." } as const;
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "ADMINISTRADOR") {
    return { error: "No tienes permisos de administrador." } as const;
  }

  return { supabase, adminId: user.id } as const;
}
