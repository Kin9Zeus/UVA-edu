# Runbook: webhook perdido / pago que quedó a medias

Qué hacer cuando un estudiante dice "pagué y no me dieron acceso", o Sentry
alerta en el área `webhook`/`email` de Wompi/Stripe. Hoy solo hay pagos con
Wompi en producción (P2-3/Addendum, `AUDIT-2026-09-15.md`) — Stripe está
implementado pero no conectado a ningún checkout real todavía, así que este
runbook se centra en Wompi.

## Por qué "perdido" casi nunca significa perdido de verdad

Wompi reintenta la entrega de un webhook si no recibe `2xx`, y el handler
(`src/app/api/webhooks/wompi/route.ts`) está diseñado para que un evento que
no se pudo aplicar responda `5xx` a propósito (ver `conciliarTransaccion`,
`src/lib/pagos/conciliacion.ts`) — así Wompi lo reintenta en vez de darlo por
entregado. El caso real de "perdido" (nunca llegó ninguna entrega) es mucho
menos común que "llegó, pero algo lo dejó sin aplicar" — por eso el primer
paso siempre es mirar la base, no asumir que Wompi no mandó nada.

## Paso 1 — Ubicar el evento

Con Service Role Key (Supabase SQL Editor o `psql` contra `DATABASE_URL`):

```sql
-- Por referencia del intento (la que el estudiante ve en su pantalla de
-- checkout, o la que Wompi muestra en su propio dashboard).
select * from intentos_pago where referencia = '<referencia>';

-- Eventos de webhook para esa referencia, más recientes primero. El
-- checksum es la clave de idempotencia de Wompi (no manda id de evento
-- propio, ver la cabecera de src/app/api/webhooks/wompi/route.ts).
select id, tipo_evento, procesado, creado_en, payload
from eventos_webhook
where proveedor = 'wompi'
  and payload->'data'->'transaction'->>'reference' = '<referencia>'
order by creado_en desc;
```

Tres escenarios posibles:

1. **No hay ninguna fila en `eventos_webhook`** — el webhook de verdad nunca
   llegó (Wompi no lo mandó, o no llegó a pasar el firewall/DNS de
   Railway). Ir al Paso 2.
2. **Hay una fila con `procesado = false`** — llegó, pero
   `conciliarTransaccion` devolvió `error` (el handler respondió `5xx`) y
   Wompi todavía está reintentando, o ya agotó sus reintentos. Ir al Paso 3.
3. **Hay una fila con `procesado = true` pero `intentos_pago.estado` sigue
   en `PENDIENTE`** — el evento se procesó pero no era el de aprobación
   (`transaction.updated` con `status` distinto de `APPROVED`), o el
   `resultado.estado` fue `pendiente`/`rechazado`. Revisar el `payload` de
   esa fila para ver qué `status` trajo Wompi.

## Paso 2 — El webhook nunca llegó

1. Confirmar en el dashboard de Wompi (Desarrolladores → Eventos) si Wompi
   registra un intento de entrega para esa transacción y qué código de
   respuesta recibió. Si Wompi no tiene ningún intento, el problema es del
   lado de Wompi/red, no de la app — reintenta solo, no hay nada que hacer
   en el código.
2. Si Wompi sí registra un intento con código de respuesta que no sea
   `2xx`/`5xx` esperado (ej. `403`, `404`, timeout), revisar Sentry
   (`scope: webhook:wompi`) por ese rango de tiempo — el log estructurado de
   `logError` trae el motivo exacto.
3. Verificar `WOMPI_EVENTS_SECRET` esté configurada en Railway — sin ella el
   handler responde `500` inmediatamente sin intentar nada (primera rama de
   `POST` en el route handler).

## Paso 3 — Llegó pero no se aplicó (`procesado = false`)

1. Mirar `payload->>'event'` de la fila: si no es `transaction.updated`, el
   handler lo ignora a propósito y de todas formas lo marca procesado — no
   debería quedar en `false` en ese caso; si aparece así, es indicio de un
   fallo al escribir `eventos_webhook.procesado` (ver `marcarProcesado`,
   que solo loguea sin abortar si el `UPDATE` falla).
2. Si es `transaction.updated`, el motivo casi siempre está en Sentry
   (`scope: webhook:wompi`, buscar por la `referencia` o el `idTransaccion`
   en `extra`). Las causas típicas, de más a menos común:
   - `"no se pudo consultar la transacción en Wompi"` — la verificación
     contra la API real de Wompi (`consultarTransaccion`,
     `src/lib/pagos/wompi.ts`) falló (Wompi caído, timeout, o la
     transacción no existe del lado de ellos). Reintentar suele bastar; si
     persiste, confirmar el estado de la transacción a mano en el
     dashboard de Wompi.
   - Un error del RPC `aplicar_pago_wompi`/`rechazar_intento_pago` — el
     `mensaje` del log es el error real de Postgres. Revisar
     `supabase/sql/101_intentos_pago.sql`.
3. Wompi reintenta automáticamente mientras el handler siga respondiendo
   `5xx` — no hay que forzar nada mientras el evento siga sin `procesado`.
   Si Wompi ya agotó su ventana de reintentos (confirmar en su dashboard) y
   la causa ya está resuelta (ej. Wompi volvió a responder, o se corrigió
   algo), no existe hoy un botón ni un script que reprocese un evento
   guardado — hay que **volver a llamar `conciliarTransaccion()`** con los
   mismos datos del `payload`, vía un script ad-hoc (mismo patrón que
   `scripts/pagos-e2e-test.ts`, que ya construye un `TransaccionEvento` y la
   llama directo). No hay un runbook de "reenviar desde el dashboard de
   Wompi" verificado — confirmar si esa opción existe ahí antes de escribir
   el script.

## Qué NO hacer

- **No** escribir `intentos_pago`/`suscripciones`/`pagos` a mano por SQL
  Editor para "destrabar" un pago. `aplicar_pago_wompi` toca 5 tablas de
  forma atómica (`src/lib/pagos/conciliacion.ts`, cabecera) — reproducir eso
  a mano deja el estado fácil de romper (ej. cupón sin marcar como usado,
  o sin fila en `pagos` para el recibo).
- **No** marcar `eventos_webhook.procesado = true` a mano para silenciar un
  reintento sin haber aplicado el pago — eso hace que Wompi deje de
  reintentar un evento que nunca se procesó, perdiendo la única señal de
  que hay que intervenir manualmente.

## Qué falta (deuda conocida, no bloqueante)

No existe un script ni un botón de panel para reconciliar un pago
puntual sin escribir código ad-hoc en el momento del incidente. Si esto se
vuelve frecuente, vale la pena un `scripts/pagos-reconciliar.ts` que reciba
una `referencia` o un `id` de transacción de Wompi y llame
`conciliarTransaccion()` directamente — hoy no existe porque, hasta el
09-15, el volumen de pagos reales en producción no lo había hecho necesario
(ver P1-3/addendum de `AUDIT-2026-09-15.md`: sin concurrencia real de
usuarios todavía).
