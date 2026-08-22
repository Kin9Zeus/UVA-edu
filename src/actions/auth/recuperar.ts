"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RecuperarState = { error: string; success?: never } | { error?: never; success: true } | null;

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("host");
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function recuperar(
  _prevState: RecuperarState,
  formData: FormData,
): Promise<RecuperarState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  const origin = await getOrigin();
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
    console.error("[recuperar] resetPasswordForEmail error:", error);
  }

  // Siempre se responde con éxito, exista o no la cuenta, para no filtrar
  // qué correos están registrados (mismo mensaje que ya mostraba la UI).
  return { success: true };
}
