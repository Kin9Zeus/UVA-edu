"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteUrl } from "@/lib/site-url";
import { logError } from "@/lib/log";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecuperarState = { error: string; success?: never } | { error?: never; success: true } | null;

export async function recuperar(
  _prevState: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  // 022_rate_limit_login_y_recuperacion.sql: 1 solicitud por correo cada
  // 60 segundos. Si está bloqueado, no se llama a resetPasswordForEmail,
  // pero igual se responde con éxito más abajo — bloquear el envío no
  // debe traducirse en una respuesta distinta que delate el estado
  // (mismo criterio anti-enumeración que ya aplicaba este archivo).
  const admin = createAdminClient();
  const { data: permitido, error: errorRateLimit } = await admin.rpc(
    "registrar_solicitud_recuperacion",
    { p_correo: email },
  );

  if (errorRateLimit) {
    logError("recuperar", "registrar_solicitud_recuperacion rpc falló", errorRateLimit);
  }

  // Si el RPC del rate limit falla, se falla abierto (se intenta enviar
  // igual): un error transitorio en la función no debería bloquear un
  // flujo de recuperación de contraseña legítimo.
  if (errorRateLimit || permitido) {
    const origin = siteUrl();
    const supabase = await createClient();
    // Va a /auth/confirm (no directo a /actualizar-password): mientras el
    // "Send Email" hook (src/app/api/webhooks/supabase-auth/route.ts) no esté
    // configurado/alcanzable, Supabase manda su propio correo con enlace a
    // este mismo redirectTo + "?code=" (PKCE), y es /auth/confirm quien sabe
    // canjear ese code. Si el hook llega a estar activo, ver la nota en
    // ese webhook sobre evitar el doble anidado con este mismo next.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/confirm?next=/actualizar-password`,
    });

    if (error) {
      logError("recuperar", "resetPasswordForEmail error", error, { area: "email" });
    }
  }

  // Siempre se responde con éxito, exista la cuenta o no, y aunque el
  // rate limit haya bloqueado el envío — para no filtrar qué correos
  // están registrados (mismo mensaje que ya mostraba la UI).
  return { success: true };
}
