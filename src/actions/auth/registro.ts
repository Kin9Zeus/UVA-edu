"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPasswordValid } from "@/lib/password";

export type RegistroState =
  | { error: string; needsConfirmation?: never }
  | { error?: never; needsConfirmation: true }
  | null;

export async function registro(
  _prevState: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const nombre = String(formData.get("name") ?? "").trim();

  if (!email || !nombre) {
    return { error: "Completa tu correo y tu nombre." };
  }
  if (!isPasswordValid(password)) {
    return { error: "La contraseña no cumple los requisitos." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre } },
  });

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

  redirect("/dashboard");
}
