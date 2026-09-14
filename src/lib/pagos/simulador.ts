import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import type { EstadoTransaccion } from "@/lib/pagos/wompi";

/**
 * Simulador local de Wompi: permite probar el flujo de cobro COMPLETO sin
 * tener cuenta de comercio ni llaves de sandbox.
 *
 * Por qué se puede simular de verdad
 * ----------------------------------
 * En este flujo nosotros controlamos los dos extremos: la referencia la
 * inventamos nosotros y el checksum del evento se calcula con un secreto
 * nuestro (`WOMPI_EVENTS_SECRET`). Así que un emisor local puede producir un
 * evento indistinguible del real para el handler.
 *
 * Lo importante es qué NO cambia: el evento simulado entra por el MISMO
 * endpoint (`/api/webhooks/wompi`), pasa la MISMA verificación de checksum,
 * el MISMO registro de idempotencia en `eventos_webhook` y la MISMA
 * conciliación. No hay una rama "si es prueba" en la lógica de negocio — solo
 * cambia quién manda el evento. Eso es lo que hace que la prueba valga: se
 * ejercita el código que va a correr en producción.
 *
 * Lo único que el simulador NO prueba es la pantalla de pago de Wompi y que
 * las llaves reales sean correctas. Eso necesita sandbox de verdad.
 *
 * SEGURIDAD
 * ---------
 * Está apagado salvo que se pidan DOS cosas a la vez, y ninguna puede darse
 * en un despliegue de producción:
 *   - `NODE_ENV` distinto de "production", y
 *   - `WOMPI_SIMULADOR=1` explícito en el entorno.
 * Un despliegue real corre con NODE_ENV=production, así que la primera
 * condición basta aunque alguien copie la variable por error.
 */
export function simuladorActivo(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WOMPI_SIMULADOR === "1";
}

/**
 * Cabecera con la que el simulador se identifica ante el webhook.
 *
 * No es un mecanismo de seguridad —cualquiera puede mandar una cabecera— sino
 * una señal para saltarse la consulta a la API de Wompi, que devolvería 404
 * para una transacción que no existe del lado de Wompi. La seguridad la da
 * `simuladorActivo()`: sin él, la cabecera no hace absolutamente nada.
 */
export const CABECERA_SIMULADOR = "x-uva-simulador";

export function esEventoSimulado(request: NextRequest): boolean {
  return simuladorActivo() && request.headers.get(CABECERA_SIMULADOR) === "1";
}

/**
 * Construye un evento de Wompi firmado igual que uno real.
 *
 * El checksum sigue la misma regla que verifica el handler:
 *
 *   SHA256( concat(valores de `properties`, en orden) + timestamp + secreto )
 *
 * `properties` son las rutas dentro de `data` que entran al hash, y el orden
 * importa. Se usan las tres que manda Wompi para `transaction.updated`.
 */
export function construirEventoSimulado(params: {
  referencia: string;
  idTransaccion: string;
  estado: EstadoTransaccion;
  montoCentavos: number;
  moneda: string;
  secretoEventos: string;
}) {
  const data = {
    transaction: {
      id: params.idTransaccion,
      reference: params.referencia,
      status: params.estado,
      amount_in_cents: params.montoCentavos,
      currency: params.moneda,
      // Null mientras está PENDING, igual que Wompi.
      finalized_at: params.estado === "PENDING" ? null : new Date().toISOString(),
      payment_method_type: "CARD",
    },
  };

  const properties = ["transaction.id", "transaction.status", "transaction.amount_in_cents"];
  const timestamp = Math.floor(Date.now() / 1000);

  const concatenado =
    properties.map((ruta) => valorEnRuta(data, ruta)).join("") +
    String(timestamp) +
    params.secretoEventos;

  return {
    event: "transaction.updated",
    data,
    timestamp,
    signature: {
      properties,
      checksum: createHash("sha256").update(concatenado, "utf8").digest("hex"),
    },
  };
}

/** Gemela de la del handler: resuelve "transaction.id" contra `data`. */
function valorEnRuta(data: unknown, ruta: string): string {
  let actual: unknown = data;
  for (const segmento of ruta.split(".")) {
    if (typeof actual !== "object" || actual === null) return "";
    actual = (actual as Record<string, unknown>)[segmento];
  }
  return actual === undefined || actual === null ? "" : String(actual);
}

/** Id de transacción con la forma de los de Wompi, para que se distinga de una referencia. */
export function generarIdTransaccionSimulada(): string {
  return `sim-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
