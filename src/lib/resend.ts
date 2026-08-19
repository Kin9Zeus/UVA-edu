import { resend } from "@/lib/resend/client";
import { WelcomeEmail } from "@/emails/welcome";

export { resend };

export type EnviarCorreoResultado =
  | { success: true; id: string }
  | { success: false; error: string };

export async function enviarCorreoBienvenida(
  destinatario: string,
  nombre: string,
  urlAcceso: string,
): Promise<EnviarCorreoResultado> {
  try {
    const { data, error } = await resend.emails.send({
      // TODO: cambiar a un dominio propio verificado en Resend antes de
      // pasar a producción (Resend Dashboard → Domains).
      from: "U.V.A <onboarding@resend.dev>",
      to: destinatario,
      subject: "Bienvenido a U.V.A",
      react: WelcomeEmail({ nombre, urlAcceso }),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Error desconocido al enviar el correo.",
    };
  }
}
