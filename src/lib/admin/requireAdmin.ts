import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/perfil";
import { getNivelAalActual } from "@/lib/auth/aal";

/**
 * Guard para Server Actions del panel admin. RLS ya bloquea en la base de
 * datos cualquier mutación de un no-administrador (private.es_administrador(),
 * ver supabase/sql/00{1,2,3,4}_*.sql), pero esta verificación evita el
 * roundtrip innecesario y da un mensaje de error legible en vez de que la
 * query falle silenciosamente por RLS.
 *
 * FASE 8.1 (2FA de administradores): además de ser administrador, la sesión
 * debe ser aal2 (contraseña + código de la app de autenticación). Se comprueba
 * DESPUÉS del rol y no antes, a propósito: a un estudiante hay que decirle "no
 * tienes permisos", no "te falta el segundo factor", que le sugeriría que
 * activándolo entra. Y es un guard central: cubre las acciones de
 * `actions/admin` sin tocarlas una por una.
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

  // Falla cerrado: solo el nivel exacto aal2 pasa (ver nivelAalDeClaims). Un
  // administrador con la contraseña robada pero sin el celular llega hasta
  // acá con aal1 y no recibe el cliente de Supabase que devolvería el guard.
  if ((await getNivelAalActual()) !== "aal2") {
    return {
      error: "Tu sesión no tiene la verificación en dos pasos. Inicia sesión de nuevo y escribe el código de tu app.",
    } as const;
  }

  return { supabase, adminId: user.id } as const;
}
