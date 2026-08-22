import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export const getPerfilActual = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, perfil: null };
  }

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, correo, celular, rol, estado")
    .eq("id", user.id)
    .single();

  return { user, perfil };
});
