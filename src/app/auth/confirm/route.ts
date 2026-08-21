import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // El webhook de correo (src/app/api/webhooks/supabase-auth/route.ts)
  // arma el enlace como .../auth/confirm?token_hash=...&next=<redirect_to
  // codificado>, y redirect_to es el emailRedirectTo/redirectTo tal cual
  // se pasó a signUp()/resend()/resetPasswordForEmail() — que en este
  // proyecto ya es una URL absoluta al destino final (ej.
  // "http://.../login?signout=1"), no otro /auth/confirm. new URL(...)
  // normaliza tanto ese caso como un `next` relativo simple, para poder
  // leer sus propios query params antes de redirigir.
  const nextUrl = new URL(searchParams.get("next") ?? "/", request.url);
  // Ver src/actions/auth/registro.ts y reenviar-verificacion.ts: al
  // confirmar el registro se cierra la sesión que deja el enlace antes de
  // redirigir, para que el usuario vuelva a ingresar sus credenciales en
  // /login en vez de quedar logueado de una vez (mismo criterio que
  // actualizar-password.ts tras un reset de contraseña).
  const signOutAlConfirmar = nextUrl.searchParams.get("signout") === "1";
  nextUrl.searchParams.delete("signout");
  const next = `${nextUrl.pathname}${nextUrl.search}`;

  const supabase = await createClient();

  // El cliente (@supabase/ssr) usa flujo PKCE por defecto: el enlace de
  // Supabase (`.../auth/v1/verify?...&type=recovery&redirect_to=...`)
  // redirige aquí con `?code=` en vez de `token_hash`/`type`.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      if (signOutAlConfirmar) {
        await supabase.auth.signOut();
      }
      redirect(next);
    }

    console.error("[auth/confirm] exchangeCodeForSession falló:", error.message);
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
