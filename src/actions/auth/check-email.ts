"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CheckEmailResult =
  | { exists: boolean; provider: "password" | "google" | "both" | null }
  | { error: string };

export async function checkEmail(email: string): Promise<CheckEmailResult> {
  const trimmed = email.trim();

  if (!EMAIL_PATTERN.test(trimmed)) {
    return { error: "Ingresa un correo electrónico válido." };
  }

  const admin = createAdminClient();
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
