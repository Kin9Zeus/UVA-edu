"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { procesarFotoPerfil } from "@/lib/fotoPerfilServidor";

const BUCKET_AVATARES = "avatares";

export type FotoPerfilResultado = { error: string } | { success: true; url: string };

function extraerRutaAvatar(url: string | null) {
  if (!url) return null;
  const marcador = `/object/public/${BUCKET_AVATARES}/`;
  const indice = url.indexOf(marcador);
  return indice === -1 ? null : url.slice(indice + marcador.length);
}

/**
 * Sube (o reemplaza) la foto de perfil del propio usuario logueado — nunca
 * la de otro, ni siquiera un admin: no hay parámetro de usuario, sale
 * siempre de la sesión. Mismo patrón que subirPortadaCurso
 * (src/actions/admin/cursos.ts): nombre de archivo aleatorio (evita
 * colisiones y que una foto vieja quede cacheada bajo la misma URL), sube
 * primero, actualiza la fila, y solo si eso confirma borra el archivo
 * anterior — así un fallo a mitad de camino nunca deja al usuario sin foto.
 */
export async function subirFotoPerfil(formData: FormData): Promise<FotoPerfilResultado> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const archivo = formData.get("archivo");
  if (!(archivo instanceof File)) return { error: "Selecciona una imagen." };

  const procesada = await procesarFotoPerfil(archivo);
  if ("error" in procesada) return { error: procesada.error };
  const { cuerpo, contentType, extension } = procesada.foto;

  const { data: perfilAnterior } = await supabase
    .from("perfiles")
    .select("foto_url")
    .eq("id", user.id)
    .single();

  const rutaArchivo = `${user.id}/${randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_AVATARES)
    .upload(rutaArchivo, cuerpo, { contentType });
  if (errorSubida) return { error: "No pudimos subir la imagen." };

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET_AVATARES).getPublicUrl(rutaArchivo);

  const { error } = await supabase.from("perfiles").update({ foto_url: publicUrl }).eq("id", user.id);
  if (error) {
    await supabase.storage.from(BUCKET_AVATARES).remove([rutaArchivo]);
    return { error: "No pudimos guardar la foto." };
  }

  const rutaAnterior = extraerRutaAvatar(perfilAnterior?.foto_url ?? null);
  if (rutaAnterior) {
    await supabase.storage.from(BUCKET_AVATARES).remove([rutaAnterior]);
  }

  revalidatePath("/dashboard/perfil");
  revalidatePath("/admin/configuracion");
  return { success: true, url: publicUrl };
}

/** Quita la foto de perfil propia — vuelve a mostrar las iniciales. */
export async function eliminarFotoPerfil(): Promise<{ error: string } | { success: true }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Debes iniciar sesión." };

  const { data: perfil } = await supabase.from("perfiles").select("foto_url").eq("id", user.id).single();
  if (!perfil?.foto_url) return { success: true };

  const { error } = await supabase.from("perfiles").update({ foto_url: null }).eq("id", user.id);
  if (error) return { error: "No pudimos quitar la foto." };

  const ruta = extraerRutaAvatar(perfil.foto_url);
  if (ruta) {
    await supabase.storage.from(BUCKET_AVATARES).remove([ruta]);
  }

  revalidatePath("/dashboard/perfil");
  revalidatePath("/admin/configuracion");
  return { success: true };
}
