"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { buscarPaisPorCodigo } from "@/lib/paises";

export type ActualizarPerfilState = { error: string; success?: never } | { error?: never; success: true } | null;

export async function actualizarPerfil(
  _prevState: ActualizarPerfilState,
  formData: FormData,
): Promise<ActualizarPerfilState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const numeroCelular = String(formData.get("celular") ?? "").trim();
  // El indicativo viene del selector de país (src/lib/paises.ts), no de
  // texto libre: siempre resuelve a un país conocido.
  const pais = buscarPaisPorCodigo(String(formData.get("pais") ?? ""));
  const celular = numeroCelular ? `${pais.indicativo} ${numeroCelular}` : "";

  if (!nombre) {
    return { error: "El nombre no puede estar vacío." };
  }

  if (numeroCelular && !/^[0-9\s-]{5,15}$/.test(numeroCelular)) {
    return { error: "El celular no es válido. Usa solo dígitos, espacios y guiones." };
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
    .update({ nombre, celular: celular || null, pais: numeroCelular ? pais.nombre : null })
    .eq("id", user.id);

  if (error) {
    return { error: "No pudimos guardar tus cambios. Intenta de nuevo." };
  }

  revalidatePath("/dashboard", "layout");
  return { success: true };
}
