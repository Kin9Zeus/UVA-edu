import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { nivelFalloEnlace } from "@/lib/enlace-auth";
import { versionesQueSeAceptan } from "@/lib/legal/textos";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";
import {
  ANALITICA_ACTIVA,
  COOKIE_REGISTRO_PENDIENTE,
  DURACION_REGISTRO_PENDIENTE_S,
  esRegistroNuevoConGoogle,
} from "@/lib/analitica";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Este era el peor de los cuatro: redirigía a `next` sin validar NADA, ni
  // siquiera el `startsWith("/")` de los demás. `next` lo arma el botón de
  // Google desde el `?redirect=` de /login, así que
  // `/login?redirect=//phishing.com` llevaba, tras un login real con Google,
  // a otro dominio. Ver lib/redirect-seguro.ts.
  const next = destinoInternoSeguro(searchParams.get("next"));
  const providerError = searchParams.get("error_description");

  if (providerError) {
    logError("auth/callback", "proveedor devolvió error", null, { providerError });
  } else if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const cuentaNuevaConGoogle = esRegistroNuevoConGoogle(data.user);
      // Prueba del consentimiento: quien crea la cuenta con Google aceptó el
      // aviso que está debajo del botón (P1-5, supabase/sql/140). La función
      // no duplica si ya hay filas. Si falla, la cuenta ya existe: se
      // registra para completarla a mano en vez de dejar a la persona fuera.
      if (cuentaNuevaConGoogle) {
        const versiones = versionesQueSeAceptan();
        const { error: errorConsentimiento } = await supabase.rpc("registrar_consentimientos_google", {
          p_version_terminos: versiones.terminos,
          p_version_datos: versiones["datos-personales"],
        });
        if (errorConsentimiento) {
          logError("auth/callback", "no se guardó el consentimiento de Google", errorConsentimiento, {
            area: "auth",
            id_usuario: data.user.id,
          });
        }
      }
      // Cuenta nueva con Google: aviso para la analítica (lib/analitica.ts).
      if (ANALITICA_ACTIVA && cuentaNuevaConGoogle) {
        (await cookies()).set(COOKIE_REGISTRO_PENDIENTE, "google", {
          path: "/",
          maxAge: DURACION_REGISTRO_PENDIENTE_S,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
        });
      }
      redirect(next);
    }

    logError("auth/callback", "exchangeCodeForSession falló", error, {
      nivel: nivelFalloEnlace(error),
    });
  } else {
    logError("auth/callback", "falta el parámetro code en la URL", null, { url: request.url });
  }

  redirect("/login?error=enlace_invalido");
}
