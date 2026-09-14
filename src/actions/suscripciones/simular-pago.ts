"use server";

import { redirect } from "next/navigation";
import {
  CABECERA_SIMULADOR,
  construirEventoSimulado,
  generarIdTransaccionSimulada,
  simuladorActivo,
} from "@/lib/pagos/simulador";
import { logError } from "@/lib/log";

/**
 * Emite un evento de Wompi firmado contra nuestro propio webhook, como si la
 * pasarela acabara de resolver la transacción.
 *
 * SOLO existe con el simulador activo (desarrollo + WOMPI_SIMULADOR=1). En
 * cualquier otro caso rechaza antes de hacer nada.
 *
 * Invoca el handler del webhook EN PROCESO —importándolo y pasándole un
 * `Request` sintético— en vez de hacer una petición de red. Así se ejercita
 * igual el camino entero (verificación de checksum, registro en
 * `eventos_webhook`, idempotencia y conciliación), que es donde están los
 * errores que importan, sin que el evento salga nunca de esta máquina.
 *
 * La alternativa —`fetch(`${siteUrl()}/api/webhooks/wompi`)`— es una trampa:
 * `NEXT_PUBLIC_SITE_URL` puede estar apuntando al despliegue de producción
 * incluso en `next dev` (es el caso en este repo), y entonces un "pago de
 * prueba" activaría una suscripción en el servidor real. Un simulador que
 * puede tocar producción no es un simulador.
 */
export async function simularPago(
  referencia: string,
  montoCentavos: number,
  moneda: string,
  aprobar: boolean,
  urlRetorno: string,
): Promise<{ error?: string }> {
  if (!simuladorActivo()) {
    return { error: "El simulador de pagos no está habilitado." };
  }

  const secretoEventos = process.env.WOMPI_EVENTS_SECRET;
  if (!secretoEventos) {
    return {
      error:
        "Falta WOMPI_EVENTS_SECRET en .env.local. Puede ser cualquier valor mientras se simula, " +
        "pero el webhook lo necesita para verificar la firma.",
    };
  }

  const evento = construirEventoSimulado({
    referencia,
    idTransaccion: generarIdTransaccionSimulada(),
    estado: aprobar ? "APPROVED" : "DECLINED",
    montoCentavos,
    moneda,
    secretoEventos,
  });

  // Import dinámico: mantiene el handler fuera del grafo de módulos salvo
  // cuando de verdad se simula un pago.
  const { POST } = await import("@/app/api/webhooks/wompi/route");

  const respuesta = await (POST as unknown as (p: Request) => Promise<Response>)(
    new Request("http://localhost/api/webhooks/wompi", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        // Le dice al handler que no consulte la API de Wompi por una
        // transacción que allá no existe. Solo surte efecto con el simulador
        // encendido (ver `esEventoSimulado`).
        [CABECERA_SIMULADOR]: "1",
      },
      body: JSON.stringify(evento),
    }),
  );

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => "");
    logError("simularPago", "el webhook rechazó el evento simulado", null, {
      area: "pagos",
      estado: respuesta.status,
      detalle: detalle.slice(0, 300),
    });
    return { error: `El webhook respondió ${respuesta.status}. Revisa la consola del servidor.` };
  }

  // Fuera de cualquier try: redirect() funciona lanzando.
  redirect(urlRetorno);
}
