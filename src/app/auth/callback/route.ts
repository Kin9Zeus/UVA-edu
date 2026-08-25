import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logError } from "@/lib/log";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const providerError = searchParams.get("error_description");

  if (providerError) {
    logError("auth/callback", "proveedor devolvió error", null, { providerError });
  } else if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      redirect(next);
    }

    logError("auth/callback", "exchangeCodeForSession falló", error);
  } else {
    logError("auth/callback", "falta el parámetro code en la URL", null, { url: request.url });
  }

  redirect("/login?error=enlace_invalido");
}
