"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPasswordValid } from "@/lib/password";

export type RegistroState =
  | { error: string; needsConfirmation?: never }
  | { error?: never; needsConfirmation: true }
  | null;

function safeRedirectTarget(value: FormDataEntryValue | null): string {
  const target = String(value ?? "");
  return target.startsWith("/") ? target : "/dashboard";
}

export async function registro(
  _prevState: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectTarget(formData.get("redirect"));

  if (!email) {
    return { error: "Completa tu correo." };
  }
  if (!isPasswordValid(password)) {
    return { error: "La contraseña no cumple los requisitos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    console.error("[registro] supabase.auth.signUp error:", error);
    return {
      error: error.message.toLowerCase().includes("already registered")
        ? "Ya existe una cuenta con ese correo."
        : "No pudimos crear tu cuenta. Intenta de nuevo.",
    };
  }

  // Sin `session` significa que el proyecto de Supabase requiere confirmar
  // el correo antes de iniciar sesión (config. por defecto en proyectos
  // nuevos): el usuario ya quedó creado, pero debe revisar su bandeja.
  if (!data.session) {
    return { needsConfirmation: true };
  }

  redirect(redirectTo);
}
