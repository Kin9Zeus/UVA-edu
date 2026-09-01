import { resend } from "@/lib/resend/client";
import { WelcomeEmail } from "@/emails/welcome";
import { CertificadoEmitidoEmail } from "@/emails/certificado-emitido";

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
      from: process.env.RESEND_FROM_EMAIL!,
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

/**
 * Correo de "certificado listo" (Deteccion.md: "notificar cuando esté
 * listo"). La llama exclusivamente
 * scripts/certificados-enviar-notificaciones.ts — nunca un Server Action
 * ni el trigger de emisión (private.emitir_certificado_si_completo, SQL
 * 047, corre SECURITY DEFINER en la sesión del estudiante y no tiene
 * acceso de red). Ver ese script para el porqué del outbox en vez de un
 * envío síncrono en el momento de la emisión.
 */
export async function enviarCorreoCertificadoEmitido(
  destinatario: string,
  nombre: string,
  cursoTitulo: string,
  codigoVerificacion: string,
  urlCertificados: string,
): Promise<EnviarCorreoResultado> {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: destinatario,
      subject: `Tu certificado de ${cursoTitulo} ya está listo`,
      react: CertificadoEmitidoEmail({
        nombre,
        cursoTitulo,
        codigoVerificacion,
        urlCertificados,
      }),
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
