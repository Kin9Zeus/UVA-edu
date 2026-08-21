"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type ReenviarVerificacionState =
  | { error: string; success?: never }
  | { error?: never; success: true }
  | null;

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("host");
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function reenviarVerificacion(
  _prevState: ReenviarVerificacionState,
  formData: FormData,
): Promise<ReenviarVerificacionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!EMAIL_PATTERN.test(email)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  const admin = createAdminClient();
  const { data: permitido, error: rpcError } = await admin.rpc(
    "registrar_reenvio_verificacion",
    { p_correo: email },
  );

  if (rpcError) {
    console.error("[reenviarVerificacion] registrar_reenvio_verificacion rpc falló:", rpcError);
    return { error: "No pudimos procesar tu solicitud. Intenta de nuevo." };
  }

  if (!permitido) {
    return { error: "Espera un minuto antes de solicitar otro enlace." };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: {
      // Ver la nota en registro.ts: destino final directo, no /auth/confirm,
      // con el correo precargado para saltar directo al paso de contraseña.
      emailRedirectTo: `${origin}/login?signout=1&email=${encodeURIComponent(email)}`,
    },
  });

  if (error) {
    console.error("[reenviarVerificacion] resend error:", error);
  }

  // Siempre se responde con éxito, exista o no la cuenta / ya esté
  // verificada, para no filtrar esa información (mismo criterio que
  // recuperar.ts).
  return { success: true };
}
