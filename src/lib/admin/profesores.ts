import { createClient } from "@/lib/supabase/server";

export type PerfilProfesor = {
  id: string;
  nombre: string;
  especialidad: string | null;
};

/**
 * Cuentas con rol PROFESOR, para el selector de instructores del formulario de
 * curso.
 *
 * Reemplaza a `getInstructoresParaSelector()` (lib/admin/instructores.ts,
 * eliminada): instructor y profesor son la misma entidad, y una fila de
 * `perfiles` solo puede nacer del trigger sobre `auth.users`
 * (supabase/sql/000_trigger_perfiles.sql). O sea que esta lista NO se puede
 * alimentar desde un modal de dos campos como antes — la persona se registra
 * en /registro y un administrador la asciende desde Usuarios
 * (`cambiarRolProfesor`). Por eso el formulario de curso ya no lleva
 * "+ Nuevo instructor".
 *
 * Va sin cliente de service role: `perfiles_select_propio` (002) ya deja a un
 * administrador leer todas las filas, así que la sesión del admin alcanza.
 * Devuelve lista vacía si la consulta falla, y el formulario muestra su
 * estado vacío.
 */
export async function getPerfilesProfesor(): Promise<PerfilProfesor[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, especialidad")
    .eq("rol", "PROFESOR")
    .order("nombre", { ascending: true });

  if (error) return [];

  return (data ?? []).map((perfil) => ({
    id: perfil.id as string,
    nombre: perfil.nombre as string,
    especialidad: (perfil.especialidad as string | null) ?? null,
  }));
}
