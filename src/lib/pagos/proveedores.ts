/**
 * Los valores admitidos de `proveedor`, en un solo sitio.
 *
 * Antes vivían como literales sueltos repartidos por cinco archivos SQL
 * (017, 027, 035, 038, 041), `actions/admin/usuarios.ts` y una unión escrita
 * a mano en `lib/webhooks/eventos.ts`. Nada detectaba un `'Stripe'` con
 * mayúscula, que rompería la conciliación en silencio.
 *
 * La contraparte en la base son los CHECK de
 * `supabase/sql/042_restricciones_dinero_y_proveedor.sql`, y hay un test
 * (proveedores.test.ts) que lee ese archivo y falla si las dos listas se
 * separan — mismo patrón que ya existe entre `gracia.ts` y la ventana de
 * gracia de las vistas de métricas.
 *
 * No son un enum de Postgres a propósito: cada tabla admite un subconjunto
 * distinto (ver la cabecera de 042), y un enum compartido volvería legal
 * `pagos.proveedor = 'mux'`.
 */

/** Pasarelas de pago reales. Vacías de uso hoy: el cobro está diferido. */
export const PROVEEDORES_PASARELA = ["stripe", "wompi"] as const;

/**
 * Orígenes de acceso que NO pasan por caja.
 *
 * `invitacion`: el estudiante canjeó un código (`canjear_codigo_invitacion`).
 * `manual`: un administrador lo otorgó directo (`otorgarMembresia`).
 */
export const PROVEEDORES_SIN_COBRO = ["manual", "invitacion"] as const;

/**
 * Proveedores válidos de `suscripciones.proveedor` — el origen del acceso.
 * Incluye las pasarelas aunque hoy ninguna esté conectada: es justamente el
 * requisito de dejar el esquema listo para el cobro.
 */
export const PROVEEDORES_SUSCRIPCION = [
  ...PROVEEDORES_PASARELA,
  ...PROVEEDORES_SIN_COBRO,
] as const;

/**
 * Proveedores válidos de `pagos.proveedor` y `planes_precios.proveedor`.
 * Solo pasarelas: una membresía otorgada a mano o canjeada con un código
 * nunca genera una fila de pago — es gratis por definición.
 */
export const PROVEEDORES_PAGO = PROVEEDORES_PASARELA;

/**
 * Proveedores válidos de `eventos_webhook.proveedor`.
 *
 * Incluye `mux`, que no cobra nada: esa tabla es la bitácora de idempotencia
 * de TODO webhook entrante (CLAUDE.md §3.1), no solo de pagos. Es el motivo
 * más claro de por qué las listas viven separadas en vez de en un único enum.
 */
export const PROVEEDORES_WEBHOOK = [...PROVEEDORES_PASARELA, "mux"] as const;

export type ProveedorPasarela = (typeof PROVEEDORES_PASARELA)[number];
export type ProveedorSuscripcion = (typeof PROVEEDORES_SUSCRIPCION)[number];
export type ProveedorPago = (typeof PROVEEDORES_PAGO)[number];
export type ProveedorWebhook = (typeof PROVEEDORES_WEBHOOK)[number];

/**
 * Normaliza la moneda que reporta una pasarela al formato que exige la base
 * (`CHECK (moneda ~ '^[A-Z]{3}$')`, en 042).
 *
 * Existe porque Stripe envía la moneda en minúsculas (`"usd"`) y
 * `formatMoneda` (lib/admin/format.ts) se la pasa directo a
 * `Intl.NumberFormat`, que lanza `RangeError` con cualquier cosa que no sea
 * un ISO-4217 válido — tumbando /dashboard/suscripcion para ese estudiante.
 * Normalizar al ESCRIBIR es lo que impide que el problema llegue a la
 * lectura.
 *
 * Devuelve `null` en vez de lanzar: quien la use decide si rechaza el evento
 * o lo registra sin monto. No valida que el código exista de verdad —
 * `'ZZZ'` pasa el formato— solo que tenga la forma que la base acepta.
 */
export function normalizarMoneda(moneda: string): string | null {
  const normalizada = moneda.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(normalizada) ? normalizada : null;
}
