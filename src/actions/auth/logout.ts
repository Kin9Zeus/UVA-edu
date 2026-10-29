"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

/**
 * Cierra la sesión SOLO en este dispositivo.
 *
 * `signOut()` sin argumento usa el alcance global y cerraba también el celular
 * y el computador del mismo usuario: el botón "Cerrar sesión" decía una cosa
 * ("en este dispositivo", en Mi perfil) y hacía otra. Con `local` coincide.
 * Cerrar en todos los dispositivos es una acción distinta, con su propio
 * botón (`logoutEnTodos`).
 */
export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) logError("logout", "signOut(local) falló", error, { area: "auth" });
  redirect("/");
}

/**
 * Cierra la sesión en TODOS los dispositivos, el actual incluido. Es lo que se
 * usa cuando se sospecha que alguien más tiene una sesión abierta: anula los
 * tokens de renovación de todas las sesiones del usuario. Un token de acceso
 * ya entregado sigue valiendo hasta que vence (1 hora por defecto en Supabase).
 */
export async function logoutEnTodos() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) logError("logoutEnTodos", "signOut(global) falló", error, { area: "auth" });
  redirect("/");
}
