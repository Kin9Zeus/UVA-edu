import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";
import { nivelFalloEnlace } from "@/lib/enlace-auth";
import { destinoInternoSeguro } from "@/lib/redirect-seguro";

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
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
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
