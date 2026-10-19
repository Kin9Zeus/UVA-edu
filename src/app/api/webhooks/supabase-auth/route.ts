import { Webhook } from "standardwebhooks";
import { NextResponse, type NextRequest } from "next/server";
import { resend } from "@/lib/resend/client";
import { ASUNTO_RECUPERAR_PASSWORD, RecuperarPasswordEmail } from "@/lib/resend/emails/recuperar-password-email";
import { ASUNTO_CONFIRMAR_CUENTA, ConfirmarCuentaEmail } from "@/emails/confirmar-cuenta";
import { asuntoConfirmarAccion, ConfirmarAccionEmail } from "@/emails/confirmar-accion";
import { logError } from "@/lib/log";

/**
 * Hook de envío de correo de Supabase Auth: recibe el evento, arma el correo
 * con React Email y lo manda por Resend.
 *
 * Excepción deliberada a CLAUDE.md §3.1 ("Todo Webhook entrante debe
 * registrarse previamente en la tabla Eventos_Webhook antes de ejecutar la
 * lógica de negocio") — ver AUDIT-2026-09-04.md, P3-1. Los otros tres
 * webhooks (stripe, wompi, mux) sí pasan por `registrarEvento`/
 * `marcarProcesado`, y deben hacerlo: una reentrega duplicada de uno de
 * ellos otorga acceso dos veces, descuenta dos veces o borra un asset que ya
 * se reemplazó. Acá el peor caso de una reentrega es que a la persona le
 * llegue el mismo correo dos veces, que es molesto y nada más.
 *
 * A cambio, registrar tendría un costo que los otros tres no pagan: este
 * hook corre EN MEDIO del envío — Supabase espera la respuesta para dar por
 * enviado el correo —, así que una escritura más a la base entra en el
 * camino crítico de cada registro, cada recuperación de contraseña y cada
 * reenvío de verificación. Y si esa escritura falla, se perdería un correo
 * que sí se podía mandar.
 *
 * El dato que sí importa para depurar (a quién se le mandó qué y si falló)
 * ya queda en Sentry vía `logError`, con el correo redactado por
 * `lib/log.ts`, y en el propio panel de Resend.
 *
 * Si algún día este hook hiciera algo más que enviar un correo —tocar la
 * base, marcar un perfil, disparar otra acción—, esta excepción deja de
 * valer y hay que registrarlo como los otros tres.
 */

type SendEmailHookPayload = {
  user: {
    email: string;
    /** Solo en el cambio de correo: la dirección que se quiere confirmar. */
    new_email?: string;
    /** `nombre` lo guarda el registro (src/actions/auth/registro.ts). */
    user_metadata?: { nombre?: unknown };
  };
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
  const nombre = typeof user.user_metadata?.nombre === "string" ? user.user_metadata.nombre : undefined;

  // Notificación de seguridad nativa de Supabase (no una acción por
  // confirmar: no trae un token_hash real, así que armarle un enlace de
  // /auth/confirm solo produce uno roto). La app ya manda su propio aviso,
  // bien formado, apenas se guarda la contraseña nueva
  // (enviarCorreoPasswordActualizada, src/actions/auth/actualizar-password.ts)
  // — reenviar esta acá sería un correo duplicado y encima roto.
  if (email_data.email_action_type === "password_changed_notification") {
    return NextResponse.json({});
  }

  // redirect_to (el redirectTo pasado a resetPasswordForEmail/signUp/etc.)
  // ya puede apuntar a /auth/confirm (ver src/actions/auth/recuperar.ts,
  // que lo usa como respaldo por si este hook no llegara a dispararse). Si
  // se envuelve tal cual dentro de otro /auth/confirm?...&next=<esto>, el
  // primer salto consume el token_hash y el segundo llega sin él. Por eso
  // aquí se detecta ese caso y se añaden token_hash/type directo a esa URL
  // en vez de anidarla.
  // email_data.site_url NO es la Site URL del dashboard — es la URL base
  // de la API del proyecto Supabase (https://[ref].supabase.co/auth/v1).
  // El dominio real de la app hay que sacarlo del origin de redirect_to.
  const redirectTo = new URL(email_data.redirect_to || "/", email_data.site_url);
  const appOrigin = redirectTo.origin;
  let actionLink: string;
  if (redirectTo.pathname === "/auth/confirm") {
    redirectTo.searchParams.set("token_hash", email_data.token_hash);
    redirectTo.searchParams.set("type", email_data.email_action_type);
    actionLink = redirectTo.toString();
  } else {
    actionLink = `${appOrigin}/auth/confirm?token_hash=${email_data.token_hash}&type=${email_data.email_action_type}&next=${encodeURIComponent(redirectTo.pathname + redirectTo.search)}`;
  }

  // Sin try/catch, un fallo de Resend (API caída, from no verificado, etc.)
  // reventaba el módulo sin dejar rastro — exactamente el escenario que
  // P1-3 (AUDIT-2026-08-24.md) señala como el más caro: un correo que no
  // llegó y nadie se entera hasta que el usuario escribe a soporte.
  try {
    let sendResult: Awaited<ReturnType<typeof resend.emails.send>>;
    switch (email_data.email_action_type) {
      case "recovery":
        sendResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: user.email,
          subject: ASUNTO_RECUPERAR_PASSWORD,
          react: RecuperarPasswordEmail({ actionLink, nombre, correo: user.email }),
        });
        break;
      case "signup":
        sendResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: user.email,
          subject: ASUNTO_CONFIRMAR_CUENTA,
          react: ConfirmarCuentaEmail({ actionLink, nombre, correo: user.email }),
        });
        break;
      default:
        // Invitación, enlace mágico, cambio de correo y reautenticación:
        // ningún flujo de la app las dispara hoy, pero si llegan (panel de
        // Supabase) salen con el mismo diseño. Mismo destinatario y mismo
        // enlace que antes: solo cambia la presentación.
        sendResult = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: user.email,
          subject: asuntoConfirmarAccion(email_data.email_action_type),
          react: ConfirmarAccionEmail({
            tipo: email_data.email_action_type,
            actionLink,
            nombre,
            correo: user.email,
            correoNuevo: user.new_email,
          }),
        });
    }
    const { error } = sendResult;

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
