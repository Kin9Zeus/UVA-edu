"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isPasswordValid } from "@/lib/password";
import { checkEmail } from "@/actions/auth/check-email";
import { logError } from "@/lib/log";

export type RegistroState =
  | { error: string; needsConfirmation?: never; email?: never }
  | { error?: never; needsConfirmation: true; email: string }
  | null;

function safeRedirectTarget(value: FormDataEntryValue | null): string {
  const target = String(value ?? "");
  return target.startsWith("/") ? target : "/dashboard";
}

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("host");
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function registro(
  _prevState: RegistroState,
  formData: FormData,
): Promise<RegistroState> {
  const email = String(formData.get("email") ?? "").trim();
  const nombre = String(formData.get("nombre") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = safeRedirectTarget(formData.get("redirect"));

  if (!email) {
    return { error: "Completa tu correo." };
  }
  if (!nombre) {
    return { error: "Completa tu nombre." };
  }
  if (!isPasswordValid(password)) {
    return { error: "La contraseña no cumple los requisitos." };
  }

  const check = await checkEmail(email);
  if ("error" in check) {
    return { error: check.error };
  }
  if (check.exists) {
    return { error: "Ya existe una cuenta con ese correo. Inicia sesión en su lugar." };
  }

  const origin = await getOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nombre },
      // El webhook de correo (src/app/api/webhooks/supabase-auth/route.ts)
      // ya envuelve este valor dentro de su propio /auth/confirm?...&next=
      // <esto>; apuntar aquí también a /auth/confirm anidaría el redirect
      // dos veces. signout=1: /auth/confirm cierra la sesión que deja el
      // enlace antes de redirigir, para que el usuario vuelva a ingresar
      // sus credenciales en /login en vez de quedar logueado de una vez.
      // email=: precarga el correo en /login para que AuthFlow salte
      // directo al paso de contraseña, sin tener que volver a escribirlo.
      emailRedirectTo: `${origin}/login?signout=1&email=${encodeURIComponent(email)}`,
    },
  });

  if (error) {
    logError("registro", "supabase.auth.signUp error", error);

    if (error.message.toLowerCase().includes("already registered")) {
      return { error: "Ya existe una cuenta con ese correo." };
    }

    // El Send Email Hook (src/app/api/webhooks/supabase-auth/route.ts) es
    // síncrono y bloqueante por diseño de Supabase: si Resend falla ahí,
    // signUp() completo devuelve error, aunque la fila en auth.users ya
    // haya quedado creada (sin confirmar). Mostrar "no pudimos crear tu
    // cuenta" en ese caso es falso — y si el usuario reintenta, checkEmail
    // le va a decir "ya existe una cuenta", un callejón sin salida sin
    // haber recibido nunca el correo. Heurística: los errores del propio
    // signUp (contraseña débil, correo inválido, etc.) llegan con status
    // 4xx; un fallo del Hook aterriza como 500 — no hay forma más precisa
    // de distinguirlos desde acá sin que Supabase exponga un código de
    // error dedicado para esto. Se trata como needsConfirmation (misma
    // pantalla que el caso feliz, con el botón de "reenviar verificación",
    // que sí es best-effort — ver reenviar-verificacion.ts).
    if ((error.status ?? 0) >= 500) {
      return { needsConfirmation: true, email };
    }

    return { error: "No pudimos crear tu cuenta. Intenta de nuevo." };
  }

  // Sin `session` significa que el proyecto de Supabase requiere confirmar
  // el correo antes de iniciar sesión (config. por defecto en proyectos
  // nuevos): el usuario ya quedó creado, pero debe revisar su bandeja.
  if (!data.session) {
    return { needsConfirmation: true, email };
  }

  redirect(redirectTo);
}
