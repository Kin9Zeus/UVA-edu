"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActualizarPerfilState = { error: string; success?: never } | { error?: never; success: true } | null;

export async function actualizarPerfil(
  _prevState: ActualizarPerfilState,
  formData: FormData,
): Promise<ActualizarPerfilState> {
  const nombre = String(formData.get("nombre") ?? "").trim();

  if (!nombre) {
    return { error: "El nombre no puede estar vacío." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };
  }

  const { error } = await supabase
    .from("perfiles")
    .update({ nombre })
    .eq("id", user.id);

  if (error) {
    return { error: "No pudimos guardar tus cambios. Intenta de nuevo." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
