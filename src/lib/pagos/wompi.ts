/**
 * Cliente de Wompi: firma de integridad, URL del Web Checkout y consulta de
 * una transacción.
 *
 * Por qué Web Checkout por redirección y NO el widget embebido
 * -----------------------------------------------------------
 * La CSP del proyecto (src/lib/csp.ts) tiene `frame-src: 'none'` y
 * `form-action: 'self'`. El widget de Wompi vive en un iframe y exigiría abrir
 * la primera; un POST de formulario hacia Wompi exigiría abrir la segunda.
 * Una redirección del servidor (navegación GET normal) no está sujeta a
 * ninguna de las dos, así que este camino NO toca la política de seguridad.
 *
 * El otro beneficio es que el monto nunca pasa por el navegador: se calcula en
 * el servidor, se firma en el servidor y se guarda en `intentos_pago` antes de
 * redirigir. El cliente solo elige un plan.
 */

import { createHash } from "node:crypto";

/**
 * Firma de integridad del Web Checkout.
 *
 *   SHA256( referencia + monto_en_centavos + moneda + secreto_de_integridad )
 *
 * Es un hash PLANO, no un HMAC: el secreto va concatenado al final. Es el
 * mismo esquema que ya usa la verificación de eventos entrantes en
 * app/api/webhooks/wompi/route.ts — y son secretos DISTINTOS:
 *
 *   WOMPI_INTEGRITY_SECRET  -> firma lo que sale (el checkout)
 *   WOMPI_EVENTS_SECRET     -> verifica lo que entra (los webhooks)
 *
 * Confundirlos hace que Wompi rechace toda transacción con "firma inválida",
 * o que se rechace todo evento legítimo. No son intercambiables.
 */
export function firmaIntegridad(
  referencia: string,
  montoCentavos: number | bigint,
  moneda: string,
  secreto: string,
): string {
  const concatenado = `${referencia}${montoCentavos}${moneda}${secreto}`;
  return createHash("sha256").update(concatenado, "utf8").digest("hex");
}

export type ParametrosCheckout = {
  referencia: string;
  montoCentavos: number | bigint;
  moneda: string;
  /** A dónde vuelve el estudiante después de pagar. Absoluta, con dominio. */
  urlRetorno: string;
  /** Prellena el correo en el checkout; ahorra un campo al estudiante. */
  correoCliente?: string;
};

/**
 * URL del Web Checkout, ya firmada.
 *
 * Los cinco parámetros obligatorios según la documentación son `public-key`,
 * `currency`, `amount-in-cents`, `reference` y `signature:integrity`. El
 * nombre del último lleva dos puntos literales — no es un typo, y por eso se
 * construye con `URLSearchParams`, que lo codifica correctamente en vez de
 * romper la query.
 */
export function urlCheckout(parametros: ParametrosCheckout, config = leerConfig()): string {
  const query = new URLSearchParams({
    "public-key": config.publicKey,
    currency: parametros.moneda,
    "amount-in-cents": String(parametros.montoCentavos),
    reference: parametros.referencia,
    "signature:integrity": firmaIntegridad(
      parametros.referencia,
      parametros.montoCentavos,
      parametros.moneda,
      config.integritySecret,
    ),
    "redirect-url": parametros.urlRetorno,
  });

  if (parametros.correoCliente) {
    query.set("customer-data:email", parametros.correoCliente);
  }

  return `${config.checkoutUrl}/p/?${query.toString()}`;
}

/** Los cinco estados que reporta Wompi. */
export type EstadoTransaccion = "PENDING" | "APPROVED" | "DECLINED" | "VOIDED" | "ERROR";

export type TransaccionWompi = {
  id: string;
  reference: string;
  status: EstadoTransaccion;
  amount_in_cents: number;
  currency: string;
  /** ISO-8601. Null mientras la transacción sigue PENDING. */
  finalized_at: string | null;
  payment_method_type?: string;
};

/**
 * Consulta una transacción contra la API de Wompi.
 *
 * Defensa en profundidad: el webhook ya viene firmado y verificado, pero
 * confirmar contra la fuente antes de dar acceso cuesta una petición y cierra
 * el hueco de un evento que pasara la firma con contenido inesperado.
 *
 * SOLO acepta llave privada: la documentación es explícita en que las llaves
 * públicas dejaron de admitirse en este endpoint y devuelven 404. Por eso esto
 * jamás puede ejecutarse en el cliente.
 *
 * Tampoco existe búsqueda por referencia — solo por `transaction_id`. Esa es
 * la razón de que `intentos_pago` guarde la referencia ANTES de redirigir: si
 * no se guardó, no hay forma de preguntar después.
 *
 * Devuelve `null` si la transacción no existe o la API falla; quien llama
 * decide (el handler no da acceso y deja que Wompi reintente).
 */
export async function consultarTransaccion(
  idTransaccion: string,
  config = leerConfig(),
): Promise<TransaccionWompi | null> {
  const respuesta = await fetch(`${config.apiUrl}/transactions/${idTransaccion}`, {
    headers: { Authorization: `Bearer ${config.privateKey}` },
    // Nunca cachear: el estado de una transacción cambia.
    cache: "no-store",
  });

  if (!respuesta.ok) return null;

  const cuerpo = (await respuesta.json()) as { data?: TransaccionWompi };
  return cuerpo.data ?? null;
}

export type ConfigWompi = {
  publicKey: string;
  privateKey: string;
  integritySecret: string;
  /** Base del Web Checkout, sin barra final. */
  checkoutUrl: string;
  /** Base de la API, con `/v1`. Distinta entre sandbox y producción. */
  apiUrl: string;
};

/**
 * Configuración desde el entorno.
 *
 * Se lee en cada llamada, no en el ámbito del módulo, y por el mismo motivo
 * que el handler de Stripe evita importar su cliente: un `throw` en el ámbito
 * del módulo impide que la ruta CARGUE, y una ruta que no carga no rechaza
 * nada — solo devuelve 500 sin dejar registro. Fallando aquí, el error aparece
 * en el punto donde de verdad hacía falta la credencial.
 *
 * Pasar a producción es cambiar estos valores por los `prod_`; no hay ninguna
 * rama `if (sandbox)` en el código, a propósito: el camino que se prueba es
 * exactamente el que corre.
 */
export function leerConfig(): ConfigWompi {
  const publicKey = process.env.WOMPI_PUB_KEY;
  const privateKey = process.env.WOMPI_PRV_KEY;
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;

  if (!publicKey || !privateKey || !integritySecret) {
    throw new Error(
      "Faltan credenciales de Wompi (WOMPI_PUB_KEY / WOMPI_PRV_KEY / WOMPI_INTEGRITY_SECRET).",
    );
  }

  return {
    publicKey,
    privateKey,
    integritySecret,
    checkoutUrl: process.env.WOMPI_CHECKOUT_URL ?? "https://checkout.wompi.co",
    apiUrl: process.env.WOMPI_API_URL ?? "https://sandbox.wompi.co/v1",
  };
}

/**
 * Referencia única de pago.
 *
 * ALEATORIA, nunca secuencial ni derivada del id del usuario: entra en el
 * hash de integridad, viaja en una URL y vuelve en un webhook. Una referencia
 * adivinable permitiría correlacionar compras ajenas o sondear referencias
 * que no son de uno.
 *
 * El prefijo `uva_` existe para reconocerlas de un vistazo en el panel de
 * Wompi; Wompi admite alfanuméricos con guiones y guiones bajos.
 */
export function generarReferencia(): string {
  return `uva_${crypto.randomUUID().replace(/-/g, "")}`;
}
