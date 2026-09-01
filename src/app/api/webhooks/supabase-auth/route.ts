import { Webhook } from "standardwebhooks";
import { NextResponse, type NextRequest } from "next/server";
import { resend } from "@/lib/resend/client";
import { RecuperarPasswordEmail } from "@/lib/resend/emails/recuperar-password-email";
import { logError } from "@/lib/log";

type SendEmailHookPayload = {
  user: { email: string };
  email_data: {
    token_hash: string;
    email_action_type: string;
    redirect_to: string;
    site_url: string;
  };
};

const hookSecret = process.env.SEND_EMAIL_HOOK_SECRET!.replace(
  "v1,whsec_",
  "",
);

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const headers = Object.fromEntries(request.headers);

  let data: SendEmailHookPayload;
  try {
    data = new Webhook(hookSecret).verify(
      payload,
      headers,
    ) as SendEmailHookPayload;
  } catch (error) {
    logError("webhook:supabase-auth", "firma inválida", error, { area: "webhook" });
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { user, email_data } = data;
  // redirect_to (el redirectTo pasado a resetPasswordForEmail/signUp/etc.)
  // ya puede apuntar a /auth/confirm (ver src/actions/auth/recuperar.ts,
  // que lo usa como respaldo por si este hook no llegara a dispararse). Si
  // se envuelve tal cual dentro de otro /auth/confirm?...&next=<esto>, el
  // primer salto consume el token_hash y el segundo llega sin él. Por eso
  // aquí se detecta ese caso y se añaden token_hash/type directo a esa URL
  // en vez de anidarla.
  const redirectTo = new URL(email_data.redirect_to || "/", email_data.site_url);
  let actionLink: string;
  if (redirectTo.pathname === "/auth/confirm") {
    redirectTo.searchParams.set("token_hash", email_data.token_hash);
    redirectTo.searchParams.set("type", email_data.email_action_type);
    actionLink = redirectTo.toString();
  } else {
    actionLink = `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=${email_data.email_action_type}&next=${encodeURIComponent(redirectTo.pathname + redirectTo.search)}`;
  }

  // Sin try/catch, un fallo de Resend (API caída, from no verificado, etc.)
  // reventaba el módulo sin dejar rastro — exactamente el escenario que
  // P1-3 (AUDIT-2026-08-24.md) señala como el más caro: un correo que no
  // llegó y nadie se entera hasta que el usuario escribe a soporte.
  try {
    const { error } =
      email_data.email_action_type === "recovery"
        ? await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: user.email,
            subject: "Recupera tu contraseña — U.V.A",
            react: RecuperarPasswordEmail({ actionLink }),
          })
        : // Signup, invite, magic link, cambio de correo: sin plantilla dedicada aún.
          await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL!,
            to: user.email,
            subject: "Confirma tu acción en U.V.A",
            text: `Confirma tu acción en U.V.A visitando este enlace: ${actionLink}`,
          });

    if (error) {
      // Resend devuelve un objeto plano ({ name, message }), no un Error
      // — logError hace String(error) sobre lo que no es Error, y
      // String({...}) da "[object Object]", perdiendo el mensaje real.
      logError(
        "webhook:supabase-auth",
        "resend.emails.send devolvió error",
        new Error(error.message ?? JSON.stringify(error)),
        { area: "email", tipo: email_data.email_action_type },
      );
      return NextResponse.json({ error: "no se pudo enviar el correo" }, { status: 500 });
    }
  } catch (error) {
    logError("webhook:supabase-auth", "resend.emails.send falló", error, {
      area: "email",
      tipo: email_data.email_action_type,
    });
    return NextResponse.json({ error: "no se pudo enviar el correo" }, { status: 500 });
  }

  return NextResponse.json({});
}
