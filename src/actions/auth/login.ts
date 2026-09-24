"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logError } from "@/lib/log";
import { comprobarLimiteLogin } from "@/lib/limiteIntentosLogin";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";

export type LoginState =
  | { error: string; pendingVerification?: never }
  | { error?: never; pendingVerification: true }
  | null;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  // `startsWith("/")` dejaba pasar `//otro-dominio`: ver lib/redirect-seguro.ts.
  const redirectTo = destinoInternoSeguro(formData.get("redirect"));

  if (!email || !password) {
    return { error: "Ingresa tu correo y tu contraseña." };
  }

  const admin = createAdminClient();

  const bloqueo = await comprobarLimiteLogin(admin, email, "login");
  if (bloqueo) return { error: bloqueo };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // Flujo 02 (ampliación): con "Confirm email" activo, Supabase rechaza
    // el login antes de crear sesión para una cuenta sin confirmar — se
    // distingue de "credenciales incorrectas" para poder ofrecer el
    // reenvío en vez de un mensaje genérico. No cuenta como intento
    // fallido para el rate limit: no es una contraseña incorrecta.
    if (
      error.code === "email_not_confirmed" ||
      error.message.toLowerCase().includes("email not confirmed")
    ) {
      return { pendingVerification: true };
    }

    const { error: errorRegistro } = await admin.rpc("registrar_login_fallido", {
      p_correo: email,
    });
    if (errorRegistro) {
      logError("login", "registrar_login_fallido rpc falló", errorRegistro);
    }

    return { error: "Correo o contraseña incorrectos." };
  }

  // Supabase ya validó la contraseña y creó la sesión antes de que podamos
  // consultar Perfiles, así que una cuenta suspendida se cierra de inmediato
  // en vez de dejarla entrar: no basta con negar el acceso más adelante.
  const { data: perfil } = await supabase
    .from("perfiles")
    .select("estado")
    .eq("id", data.user.id)
    .single();

  if (perfil?.estado === "SUSPENDIDO") {
    await supabase.auth.signOut();
    return { error: "Tu cuenta ha sido suspendida. Contacta al soporte para más información." };
  }

  const { error: errorLimpieza } = await admin.rpc("limpiar_intentos_login", {
    p_correo: email,
  });
  if (errorLimpieza) {
    logError("login", "limpiar_intentos_login rpc falló", errorLimpieza);
  }

  redirect(redirectTo);
}
