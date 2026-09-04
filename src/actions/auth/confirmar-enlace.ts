"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

async function getOrigin() {
  const headersList = await headers();
  const host = headersList.get("host");
  const proto =
    headersList.get("x-forwarded-proto") ??
    (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Antes esta lógica corría directo en el GET de /auth/confirm (auto-verificar
 * apenas se visitaba la URL). Un escáner de enlaces de correo corporativo
 * (Microsoft Safe Links y similares) hace ese mismo GET antes de que la
 * persona real haga clic, y se quedaba con el único uso del token — la
 * persona real llegaba después a un "enlace inválido o vencido" (Sentry
 * UVA-EDU-10/13/14). Moverla a un Server Action que solo se dispara al
 * pulsar un botón evita que un escáner que solo hace GET lo consuma.
 */
export async function confirmarEnlace(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "") || null;
  const tokenHash = String(formData.get("tokenHash") ?? "") || null;
  const type = (String(formData.get("type") ?? "") || null) as EmailOtpType | null;
  const nextParam = String(formData.get("next") ?? "");

  // `next` puede llegar como URL absoluta (redirect_to ya resuelto, ver
  // src/app/api/webhooks/supabase-auth/route.ts) o como ruta relativa
  // simple — new URL(...) normaliza ambos casos contra el origin actual.
  const nextUrl = new URL(nextParam || "/", await getOrigin());
  const signOutAlConfirmar = nextUrl.searchParams.get("signout") === "1";
  nextUrl.searchParams.delete("signout");
  const next = `${nextUrl.pathname}${nextUrl.search}`;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (signOutAlConfirmar) {
        await supabase.auth.signOut();
      }
      redirect(next);
    }

    logError("auth/confirm", "exchangeCodeForSession falló", error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      if (signOutAlConfirmar) {
        await supabase.auth.signOut();
      }
      redirect(next);
    }

    logError("auth/confirm", "verifyOtp falló", error);
  } else {
    logError("auth/confirm", "faltan code o token_hash/type en la URL", null, {
      code,
      tokenHash,
      type,
    });
  }

  redirect("/login?error=enlace_invalido");
}
