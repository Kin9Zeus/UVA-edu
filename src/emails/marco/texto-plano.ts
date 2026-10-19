import type { ReactElement } from "react";
import { render } from "@react-email/components";

/**
 * Agrega la versión en texto plano a un envío con plantilla de React.
 *
 * El SDK de Resend solo genera el HTML a partir de `react`: sin `text`, el
 * correo sale únicamente en HTML, y los filtros (Outlook y Hotmail sobre todo)
 * lo cuentan como señal de spam. El texto sale de la misma plantilla, así que
 * nunca se desincroniza del diseño.
 */
export async function conTextoPlano<T extends { react: ReactElement; text?: string }>(envio: T): Promise<T & { text: string }> {
  return { ...envio, text: envio.text ?? (await render(envio.react, { plainText: true })) };
}
