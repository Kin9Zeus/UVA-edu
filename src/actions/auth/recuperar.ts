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
  // El webhook de correo (src/app/api/webhooks/supabase-auth/route.ts) ya
  // envuelve este valor dentro de su propio /auth/confirm?...&next=<esto>;
  // si aquí también se apunta a /auth/confirm se anida dos veces y el
  // segundo salto llega sin code/token_hash. Por eso va directo al
  // destino final, no a /auth/confirm.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/actualizar-password`,
  });

  if (error) {
    console.error("[recuperar] resetPasswordForEmail error:", error);
  }

  // Siempre se responde con éxito, exista o no la cuenta, para no filtrar
  // qué correos están registrados (mismo mensaje que ya mostraba la UI).
  return { success: true };
}
