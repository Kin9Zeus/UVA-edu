import { resend } from "@/lib/resend/client";
import { ASUNTO_BIENVENIDA, WelcomeEmail } from "@/emails/welcome";
import { asuntoCertificadoEmitido, CertificadoEmitidoEmail } from "@/emails/certificado-emitido";
import { ASUNTO_PASSWORD_ACTUALIZADA, ContrasenaActualizadaEmail } from "@/emails/contrasena-actualizada";
import { asuntoComunidadModerada, ComunidadModeradaEmail } from "@/emails/comunidad-moderada";
import { asuntoReciboPago, ReciboPagoEmail } from "@/emails/recibo-pago";
import { formatFechaHora } from "@/lib/admin/format";
import { siteUrl } from "@/lib/site-url";
import { conTextoPlano } from "@/emails/marco/texto-plano";

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
    const { data, error } = await resend.emails.send(await conTextoPlano({
      from: process.env.RESEND_FROM_EMAIL!,
      to: destinatario,
      subject: ASUNTO_BIENVENIDA,
      react: WelcomeEmail({ nombre, correo: destinatario, urlAcceso }),
    }));

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
    const { data, error } = await resend.emails.send(await conTextoPlano({
      from: process.env.RESEND_FROM_EMAIL!,
      to: destinatario,
      subject: asuntoCertificadoEmitido(cursoTitulo),
      react: CertificadoEmitidoEmail({
        nombre,
        cursoTitulo,
        codigoVerificacion,
        urlCertificados,
        urlVerificacion: `${siteUrl()}/verificar-certificado/${encodeURIComponent(codigoVerificacion)}`,
      }),
    }));

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

export async function enviarCorreoPasswordActualizada(
  destinatario: string,
): Promise<EnviarCorreoResultado> {
  try {
    const { data, error } = await resend.emails.send(await conTextoPlano({
      from: process.env.RESEND_FROM_EMAIL!,
      to: destinatario,
      subject: ASUNTO_PASSWORD_ACTUALIZADA,
      react: ContrasenaActualizadaEmail({
        correo: destinatario,
        // La hora del envío es la del cambio: los dos llamadores avisan justo
        // después de guardar la contraseña.
        fechaCambio: formatFechaHora(new Date().toISOString()),
        urlLogin: `${siteUrl()}/login`,
      }),
    }));

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
 * Aviso al autor cuando un admin elimina su publicación/respuesta por
 * moderación (nunca cuando el propio autor borra lo suyo — ver
 * eliminarPostComunidad/eliminarRespuestaComunidad, único llamador). El
 * motivo es obligatorio en esa Server Action antes de llegar acá.
 */
export async function enviarCorreoComunidadModerada(
  destinatario: string,
  nombre: string,
  tipoContenido: "publicación" | "respuesta",
  tituloPost: string,
  motivo: string,
  urlComunidad: string,
): Promise<EnviarCorreoResultado> {
  try {
    const { data, error } = await resend.emails.send(await conTextoPlano({
      from: process.env.RESEND_FROM_EMAIL!,
      to: destinatario,
      subject: asuntoComunidadModerada(tipoContenido),
      react: ComunidadModeradaEmail({ nombre, tipoContenido, tituloPost, motivo, urlComunidad }),
    }));

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
 * Recibo de un pago aprobado.
 *
 * La llama la conciliación del webhook (src/lib/pagos/conciliacion.ts) DESPUÉS
 * de que el pago quedó aplicado, y siempre en modo best-effort: si Resend
 * falla, el estudiante ya tiene su acceso y no se revierte nada — misma regla
 * que `canjearCodigoInvitacion` y que docs/Correos.md ("un fallo de Resend
 * nunca debe romper el registro del usuario").
 */
export async function enviarCorreoReciboPago(
  destinatario: string,
  datos: {
    nombre: string;
    planNombre: string;
    montoFormateado: string;
    fechaPago: string;
    vigenteHasta: string;
    referencia: string;
    urlSuscripcion: string;
  },
): Promise<EnviarCorreoResultado> {
  try {
    const { data, error } = await resend.emails.send(await conTextoPlano({
      from: process.env.RESEND_FROM_EMAIL!,
      to: destinatario,
      subject: asuntoReciboPago(datos.vigenteHasta),
      react: ReciboPagoEmail(datos),
    }));

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Error desconocido al enviar el correo.",
    };
  }
}
