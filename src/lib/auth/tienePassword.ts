import type { User } from "@supabase/supabase-js";

/**
 * ¿Esta cuenta tiene una contraseña propia con la que reautenticarse?
 *
 * Una cuenta creada con "Continuar con Google" solo trae la identidad
 * `google`: nunca creó contraseña, así que no hay "contraseña actual" que
 * pedirle. Sin el arreglo `identities` (no viene en todos los contextos) se
 * asume que sí la tiene: la acción que lo consulta igual falla cerrada al
 * reautenticar.
 */
export function tienePasswordPropia(user: Pick<User, "identities">): boolean {
  if (!Array.isArray(user.identities)) return true;
  return user.identities.some((identidad) => identidad.provider === "email");
}
