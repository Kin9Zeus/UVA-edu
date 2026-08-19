import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  // El cliente (@supabase/ssr) usa flujo PKCE por defecto: el enlace de
  // Supabase (`.../auth/v1/verify?...&type=recovery&redirect_to=...`)
  // redirige aquí con `?code=` en vez de `token_hash`/`type`.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      redirect(next);
    }

    console.error("[auth/confirm] exchangeCodeForSession falló:", error.message);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });

    if (!error) {
      redirect(next);
    }

    console.error("[auth/confirm] verifyOtp falló:", error.message);
  } else {
    console.error("[auth/confirm] faltan code o token_hash/type en la URL:", {
      code,
      tokenHash,
      type,
      url: request.url,
    });
  }

  redirect("/login?error=enlace_invalido");
}
