"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CheckEmailResult =
  | { exists: boolean; provider: "password" | "google" | "both" | null }
  | { error: string };

/**
 * `check_email_provider` es un oráculo de enumeración de cuentas por diseño
 * (flujo de "correo inteligente"). El límite tiene que ir por IP, no por
 * correo: el correo es justo el dato que el atacante está probando, así que
 * limitarlo por correo no frena nada (prueba uno distinto por request). Ver
 * AUDIT-2026-08-24.md, hallazgo P2-1.
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return headersList.get("x-real-ip") ?? "unknown";
}

export async function checkEmail(email: string): Promise<CheckEmailResult> {
  const trimmed = email.trim();

  if (!EMAIL_PATTERN.test(trimmed)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  const admin = createAdminClient();
  const ip = await getClientIp();

  const { data: limite, error: limiteError } = await admin
    .rpc("verificar_limite_check_email", { p_ip: ip })
    .single();

  if (limiteError) {
    logError("checkEmail", "verificar_limite_check_email rpc falló", limiteError, { area: "rate-limit" });
    return { error: "No pudimos verificar tu correo. Intenta de nuevo." };
  }

  if (!(limite as { permitido: boolean }).permitido) {
    return { error: "Demasiados intentos. Espera un momento antes de volver a intentar." };
  }

  await admin.rpc("registrar_intento_check_email", { p_ip: ip });

  const { data, error } = await admin.rpc("check_email_provider", {
    p_email: trimmed,
  });

  if (error || !data || data.length === 0) {
    logError("checkEmail", "check_email_provider rpc falló", error);
    return { error: "No pudimos verificar tu correo. Intenta de nuevo." };
  }

  const [row] = data;
  return { exists: row.account_exists, provider: row.provider };
}
