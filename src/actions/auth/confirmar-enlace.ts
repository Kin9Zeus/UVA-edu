"use server";

import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { logError } from "@/lib/log";
import { nivelFalloEnlace } from "@/lib/enlace-auth";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";
import {
  COOKIE_CORREO_CONFIRMADO,
  DURACION_CORREO_CONFIRMADO_S,
  esEnlaceDeRegistro,
  serializarCorreoConfirmado,
} from "@/lib/correo-confirmado";

/**
 * Antes esta lógica corría directo en el GET de /auth/confirm (auto-verificar
 * apenas se visitaba la URL). Un escáner de enlaces de correo corporativo
 * (Microsoft Safe Links y similares) hace ese mismo GET antes de que la
 * persona real haga clic, y se quedaba con el único uso del token — la
 * persona real llegaba después a un "enlace inválido o vencido" (Sentry
 * UVA-EDU-10/13/14). Moverla a un Server Action que solo se dispara al
 * pulsar un botón evita que un escáner que solo hace GET lo consuma.
 *
 * Los enlaces de REGISTRO (`signup` / `email`) ya no saltan directo al login:
 * al confirmar van a `/auth/confirm?estado=confirmada` ("¡Correo
 * confirmado!", con el carné) y, si el enlace no sirve, a
 * `/auth/confirm?estado=vencido` (pedir uno nuevo). El nombre y el correo del
 * carné viajan en una cookie de corta vida, no en la URL
 * (lib/correo-confirmado.ts). Recuperar contraseña y el canje por `code`
 * siguen como estaban.
 */
export async function confirmarEnlace(formData: FormData): Promise<void> {
  const code = String(formData.get("code") ?? "") || null;
  const tokenHash = String(formData.get("tokenHash") ?? "") || null;
  const type = (String(formData.get("type") ?? "") || null) as EmailOtpType | null;
  const nextParam = String(formData.get("next") ?? "");
  // El correo que trae el enlace (la página lo pasa en un campo oculto):
  // con él la pantalla de "enlace vencido" puede pedir uno nuevo sin
  // volver a preguntarlo.
  const correoDelEnlace = String(formData.get("email") ?? "").trim();
  const esRegistro = esEnlaceDeRegistro(type);

  // `next` puede llegar como URL absoluta (redirect_to ya resuelto, ver
  // src/app/api/webhooks/supabase-auth/route.ts) o como ruta relativa
  // simple — new URL(...) normaliza ambos casos contra el origin actual.
  // Solo se conservan `pathname` y `search` (ver abajo), así que el origen
  // que se pasa como base nunca sale de aquí — es únicamente lo que `new URL`
  // necesita para aceptar una ruta relativa. Aun así usa la constante y no el
  // header: dejar la versión hecha a mano mantendría viva la plantilla de la
  // que salió P1-1 (AUDIT-2026-09-04.md), que ya se había copiado seis veces.
  const nextUrl = new URL(nextParam || "/", siteUrl());
  const signOutAlConfirmar = nextUrl.searchParams.get("signout") === "1";
  nextUrl.searchParams.delete("signout");
  // Quedarse con `pathname` + `search` descarta el origen, pero no basta:
  // `https://x//phishing.com` tiene `pathname` `//phishing.com`, que el
  // navegador vuelve a leer como otro dominio. Ver lib/redirect-seguro.ts.
  const next = destinoInternoSeguro(`${nextUrl.pathname}${nextUrl.search}`);

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (signOutAlConfirmar) {
        await supabase.auth.signOut();
      }
      redirect(next);
    }

    logError("auth/confirm", "exchangeCodeForSession falló", error, {
      nivel: nivelFalloEnlace(error),
    });
  } else if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      if (esRegistro) {
        const nombre = data.user?.user_metadata?.nombre;
        (await cookies()).set(
          COOKIE_CORREO_CONFIRMADO,
          serializarCorreoConfirmado({
            nombre: typeof nombre === "string" ? nombre : "",
            correo: data.user?.email ?? correoDelEnlace,
          }),
          {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: DURACION_CORREO_CONFIRMADO_S,
            path: "/auth/confirm",
          },
        );
      }
      if (signOutAlConfirmar) {
        await supabase.auth.signOut();
      }
      redirect(
        esRegistro ? `/auth/confirm?estado=confirmada&next=${encodeURIComponent(next)}` : next,
      );
    }

    logError("auth/confirm", "verifyOtp falló", error, { nivel: nivelFalloEnlace(error) });

    if (esRegistro) {
      redirect(
        correoDelEnlace
          ? `/auth/confirm?estado=vencido&email=${encodeURIComponent(correoDelEnlace)}`
          : "/auth/confirm?estado=vencido",
      );
    }
  } else {
    logError("auth/confirm", "faltan code o token_hash/type en la URL", null, {
      code,
      tokenHash,
      type,
    });
  }

  redirect("/login?error=enlace_invalido");
}
