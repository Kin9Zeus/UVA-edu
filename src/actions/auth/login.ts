"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type LoginState =
  | { error: string; pendingVerification?: never }
  | { error?: never; pendingVerification: true }
  | null;

function safeRedirectTarget(value: FormDataEntryValue | null): string {
  const target = String(value ?? "");
  return target.startsWith("/") ? target : "/dashboard";
}

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectTarget(formData.get("redirect"));

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Flujo 02 (ampliación): con "Confirm email" activo, Supabase rechaza
    // el login antes de crear sesión para una cuenta sin confirmar — se
    // distingue de "credenciales incorrectas" para poder ofrecer el
    // reenvío en vez de un mensaje genérico.
    if (
      error.code === "email_not_confirmed" ||
      error.message.toLowerCase().includes("email not confirmed")
    ) {
      return { pendingVerification: true };
    }
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect(redirectTo);
}
