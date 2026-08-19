import { Webhook } from "standardwebhooks";
import { NextResponse, type NextRequest } from "next/server";
import { resend } from "@/lib/resend/client";
import { RecuperarPasswordEmail } from "@/lib/resend/emails/recuperar-password-email";

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
    console.error("[webhook:supabase-auth] firma inválida:", error);
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const { user, email_data } = data;
  const actionLink = `${email_data.site_url}/auth/confirm?token_hash=${email_data.token_hash}&type=${email_data.email_action_type}&next=${encodeURIComponent(email_data.redirect_to || "/")}`;

  if (email_data.email_action_type === "recovery") {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: user.email,
      subject: "Recupera tu contraseña — U.V.A",
      react: RecuperarPasswordEmail({ actionLink }),
    });
  } else {
    // Signup, invite, magic link, cambio de correo: sin plantilla dedicada aún.
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: user.email,
      subject: "Confirma tu acción en U.V.A",
      text: `Confirma tu acción en U.V.A visitando este enlace: ${actionLink}`,
    });
  }

  return NextResponse.json({});
}
