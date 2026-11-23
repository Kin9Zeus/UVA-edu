"use server";

import { createClient } from "@/lib/supabase/server";
import { isPasswordValid } from "@/lib/password";
import { enviarCorreoPasswordActualizada } from "@/lib/resend";
import { logError } from "@/lib/log";
import { mensajeErrorContrasena } from "@/lib/password";
import { rutaSegundoFactor } from "@/lib/auth/aal";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { COOKIE_RECUPERACION } from "@/lib/auth/recuperacion";

/**
 * `guardada`: la contraseña se cambió y la sesión del enlace ya se cerró; la
 * pantalla muestra "Contraseña guardada" con "Iniciar sesión" (Nueva
 * contraseña lab 7). `email` precarga el login para saltar al paso de
 * contraseña.
 */
export type ActualizarPasswordState =
  | { error: string; guardada?: never }
  | { guardada: true; email: string | null; error?: never }
  | null;

export async function actualizarPassword(
  _prevState: ActualizarPasswordState,
  formData: FormData,
): Promise<ActualizarPasswordState> {
  const password = String(formData.get("password") ?? "");
  const password2 = String(formData.get("password2") ?? "");

  if (!isPasswordValid(password)) {
    return { error: "La contraseña no cumple los requisitos." };
  }
  if (password !== password2) {
    return { error: "Las contraseñas no coinciden." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Solo la sesión que abrió el enlace del correo (lib/auth/recuperacion.ts).
  // Con una sesión normal, cambiar la contraseña pide la actual: eso es
  // /dashboard/perfil (cambiarPassword), no esta pantalla.
  const tienda = await cookies();
  if (!user || !tienda.has(COOKIE_RECUPERACION)) {
    return { error: "Tu enlace expiró o no es válido. Solicita uno nuevo." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  // Cuenta con segundo factor y sesión aal1 (la del enlace del correo): la
  // página ya manda antes a escribir el código; esto cubre quien llegue igual.
  if (error?.code === "insufficient_aal") {
    redirect(rutaSegundoFactor("verificar", "/actualizar-password"));
  }

  if (error) {
    const conocido = mensajeErrorContrasena(error.code);
    if (!conocido) logError("actualizarPassword", "updateUser falló", error, { area: "auth" });
    return { error: conocido ?? "No pudimos actualizar tu contraseña. Intenta de nuevo." };
  }

  // Best-effort: si el correo de aviso falla, no debe bloquear el cambio
  // de contraseña, que ya se aplicó. Solo queda log para investigar.
  if (user.email) {
    const resultado = await enviarCorreoPasswordActualizada(user.email);
    if (!resultado.success) {
      logError(
        "actualizarPassword",
        "enviarCorreoPasswordActualizada falló",
        new Error(resultado.error),
        { area: "email" },
      );
    }
  }

  // El enlace de recuperación deja una sesión activa; la cerramos para que
  // el usuario tenga que iniciar sesión con la contraseña nueva en vez de
  // quedar autenticado de una vez en el dashboard.
  await supabase.auth.signOut();
  tienda.delete(COOKIE_RECUPERACION);

  return { guardada: true, email: user.email ?? null };
}
