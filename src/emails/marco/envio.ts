import type { ReactElement } from "react";
import { CORREO_SOPORTE } from "@/lib/contacto";
import { conTextoPlano } from "./texto-plano";

/**
 * Todo correo transaccional pasa por aquí antes de `resend.emails.send`:
 *   · agrega la versión en texto plano (ver texto-plano.ts), y
 *   · pone `replyTo` en el buzón de soporte. El remitente (RESEND_FROM_EMAIL)
 *     es una dirección que no recibe; sin esto, quien contesta "no me llegó
 *     el código" escribe al vacío (docs/tareas/dms.md: "nada de noreply@,
 *     alguien tiene que leerlo").
 */
export async function envioTransaccional<T extends { react: ReactElement; text?: string; replyTo?: string | string[] }>(
  envio: T,
): Promise<T & { text: string; replyTo: string | string[] }> {
  return { ...(await conTextoPlano(envio)), replyTo: envio.replyTo ?? CORREO_SOPORTE };
}
