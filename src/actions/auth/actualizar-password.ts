"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPasswordValid } from "@/lib/password";

export type ActualizarPasswordState = { error: string } | null;

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

  if (!user) {
    return { error: "Tu enlace expiró o no es válido. Solicita uno nuevo." };
  }

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    return { error: "No pudimos actualizar tu contraseña. Intenta de nuevo." };
  }

  redirect("/dashboard");
}
