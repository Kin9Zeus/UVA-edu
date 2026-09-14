# Selección de pasarela de pago colombiana (post-MVP)

**Estado:** recomendación lista, pendiente decisión de negocio en §4.
**Fecha de verificación de datos:** 14 de septiembre de 2026.
**Alcance:** documento de decisión. No es una tarea de implementación.

> Todos los datos de abajo se verificaron contra documentación oficial del
> proveedor el 14-sep-2026, salvo lo marcado **(fuente secundaria)**. Las
> condiciones comerciales cambian: reconfirmar tarifas con un ejecutivo antes
> de firmar.

---

## 1. El hallazgo que cambia la decisión

La tarea asume que dos requisitos son compatibles:

- **Requisito A (cobertura):** 100 % de Colombia, con **PSE y Nequi como
  mínimo obligatorio**.
- **Requisito B (criterio decisivo):** soporte real de cobros recurrentes.

**No existe hoy ninguna pasarela colombiana que cumpla los dos a la vez.**

| | Nequi | Recurrencia nativa |
|---|---|---|
| Wompi | Sí, nativo (mismo grupo) | No |
| ePayco | No lo lista | Sí |
| Mercado Pago | No lo lista | Sí |
| PayU | No | No (descontinuada) |
| Bold | — | No (reconocido por Bold) |

La razón de fondo es del mercado, no de las pasarelas: **PSE y Nequi son
autorizaciones por transacción**, no mandatos de débito automático. El cobro
mensual sin intervención del usuario solo existe de forma limpia sobre
**tarjeta tokenizada**. Cualquier pasarela que ofrezca "suscripciones" en
Colombia lo hace, en la práctica, sobre tarjeta.

Por lo tanto la decisión real no es *qué pasarela*, sino **qué modelo de cobro
adopta UVA** (§4). La pasarela sale de ahí.

---

## 2. Tabla comparativa

| Criterio | **Wompi** | **ePayco** | **Mercado Pago** | **PayU Latam** | **Bold** |
|---|---|---|---|---|---|
| **Medios en Colombia** | Tarjetas, PSE, **Nequi**, Daviplata, Botón Bancolombia, efectivo (Efecty/Baloto), SU+Pay | Tarjetas (+ Codensa, Credencial), PSE, **Daviplata**, PayPal, SafetyPay, efectivo (Efecty, Gana, Baloto, PuntoRed). **+22 medios; Nequi no aparece** | Tarjetas, PSE, Efecty, dinero en cuenta. **Nequi no listado** | Tarjetas, PSE, efectivo | Tarjetas, PSE |
| **PSE** | Sí | Sí | Sí | Sí | Sí |
| **Nequi** | **Sí** | No | No | No | No |
| **Recurrencia nativa** | **No.** Solo *payment sources* (tokenización): el comercio programa cobros, reintentos y `past_due` | **Sí.** API `recurring/v1` — planes, clientes, suscripciones | **Sí.** `preapproval` / `preapproval_plan`, frecuencia semanal/mensual/anual, **reintentos automáticos** y actualización automática de tarjetas | **No. Descontinuada** — la doc está marcada *deprecated*; remiten a tokenización | **No.** Bold: *"Estamos trabajando para que más adelante podamos contar con API's independientes para pagos recurrentes y membresías"* |
| **Comisión** | 2,65 % + $700 + IVA, **plana para todos los medios** (fuente secundaria) | Agregador: 2,64 % + $690 + IVA (cuenta Davivienda) / **3,29 % + $700 + IVA (otros bancos)**. Gateway: $490.000 de afiliación + desde $101/transacción | 3,29 % + $800 + IVA (inmediato) · 2,99 % (7 días) · 2,79 % (14 días) | Variable por negociación | Variable |
| **Costos ocultos** | Sin costo fijo ni afiliación | Retiro $6.500 + IVA · PSE < $60.000 cobra $2.000 + IVA fijo · retención 1,5 % | Sin costo fijo | Afiliación negociada | — |
| **Dispersión** | **Día hábil siguiente** (a Bancolombia o Nequi) | Agregador 24–72 h · **Gateway 20–30 días** | Según tarifa elegida: inmediato / 7 / 14 días | Variable | 1–2 días hábiles |
| **Sandbox** | Sí — `sandbox.wompi.co/v1`, llaves `pub_test_`, `prv_test_`, `test_events_`, `test_integrity_`. Ambientes independientes | Sí | Sí (usuarios y credenciales de prueba) | Sí | Sí |
| **Webhooks firmados** | Sí — checksum SHA-256 sobre `properties` + `timestamp` + secreto de eventos | Sí — firma `x_signature`; exige HTTP 200 en < 30 s | Sí — firma `x-signature` | Sí | Sí |
| **Habilitación** | Documento de identidad + RUT activo. **1–3 días hábiles.** Exige cuenta **Bancolombia o Nequi** a nombre del titular (> 30 días de antigüedad si es persona natural) | Agregador: afiliación gratis, **24–72 h**. Gateway: **20–30 días** | Crear cuenta Mercado Pago — el trámite más liviano | El más pesado de los cinco | Rápido |
| **Cobertura LATAM** | **Solo Colombia** | Principalmente Colombia | **La más amplia**: AR, BR, MX, CL, PE, UY, CO | Varios países | Solo Colombia |
| **Costo de integración para UVA** | **Casi cero** — el webhook ya está implementado y verificado | Medio | Medio | Alto | Medio |

### Descartadas de entrada

- **Bold** — no tiene API de recurrencia y ellos mismos lo declaran pendiente.
  Falla el criterio decisivo sin margen de interpretación.
- **PayU Latam** — retiró la recurrencia nativa. Quedaría igual que Wompi
  (construirla a mano) pero con integración más pesada, sin Nequi y sin la
  ventaja de dispersión. No hay razón para elegirla sobre Wompi.

---

## 3. Recomendación: **Wompi**, con modelo de renovación prepagada

**Razón en una línea:** el único requisito que la propia tarea marca como
obligatorio y no negociable es *PSE y Nequi*, y **Wompi es la única candidata
que cubre Nequi**. La recurrencia, que es el criterio decisivo, resulta ser
construible en Wompi y **parcialmente ilusoria en las demás** — ninguna puede
debitar automáticamente a un estudiante que paga por Nequi o PSE.

Sustento adicional:

1. **Cobertura real del 100 % del país.** Nequi, Bancolombia a la mano y pago
   en efectivo por corresponsales alcanzan al estudiante no bancarizado o sin
   tarjeta — exactamente el segmento que las otras opciones dejan fuera. Para
   un producto educativo masivo en Colombia esto no es un detalle.
2. **La comisión plana favorece el caso de UVA.** Que PSE cueste lo mismo que
   tarjeta es inusual en el mercado; en ePayco con cuenta no-Davivienda la
   comisión sube a 3,29 % + $700, y en Mercado Pago con disponibilidad
   inmediata a 3,29 % + $800.
3. **Dispersión al día hábil siguiente**, contra 7–14 días de Mercado Pago si
   se quiere su tarifa competitiva, o 20–30 días del modelo Gateway de ePayco.
4. **Trámite de 1–3 días hábiles** — el más corto junto con Mercado Pago.
5. **Costo de cambio cero.** `src/app/api/webhooks/wompi/route.ts` ya tiene la
   verificación de checksum SHA-256 y la idempotencia contra `eventos_webhook`
   implementadas y probadas. El esquema (`planes_precios`, `suscripciones`,
   `pagos`) ya es agnóstico de pasarela. Elegir otra pasarela tira ese trabajo.

### Lo que hay que construir, y que esta recomendación asume

Wompi no renueva solo. El modelo propuesto es **período prepagado**:

- El estudiante paga y se le abren `planes.duracion_dias`. El esquema ya lo
  soporta (`duracion_dias`, `fecha_renovacion`, vencimiento por fecha en
  `038_vigencia_por_fecha.sql`, período de gracia en `lib/gracia.ts`).
- **Quien paga con tarjeta** puede optar por renovación automática vía
  *payment source* tokenizada + un job programado que UVA ejecuta.
- **Quien paga con Nequi, PSE o efectivo** recibe recordatorio por Resend
  antes del vencimiento y renueva con un clic. Es fricción real, pero es la
  única opción honesta: ninguna pasarela puede debitarle automáticamente.

El Flujo 06 de `functional-spec.md` (renovación automática, `past_due`,
reintentos días 1/3/5) describe comportamiento de **Stripe Billing** y no
aplica tal cual a ninguna pasarela colombiana. Hay que reescribirlo.

### Cuándo cambiaría esta recomendación

- **Si el negocio exige débito automático sin fricción** y acepta perder Nequi
  → **Mercado Pago**, por recurrencia nativa con reintentos y por ser la mejor
  puerta a la expansión regional. Se paga con menor cobertura local y
  dispersión más lenta o más cara.
- **Si la expansión a LATAM pasa a ser prioridad de corto plazo** →
  Mercado Pago, por la misma razón. Hoy el documento la clasifica como
  secundaria.
- Wompi y Stripe **no son excluyentes**: la spec ya contempla Stripe para
  cobro internacional, y `planes_precios` admite el mismo plan con precio en
  COP y en USD por proveedor distinto.

---

## 4. Decisión pendiente de negocio (bloquea el trámite)

**¿UVA acepta el modelo de renovación prepagada con recordatorio, o exige
débito automático mensual?**

- Acepta prepagada → **Wompi**, iniciar trámite ya.
- Exige débito automático → **Mercado Pago**, asumiendo la pérdida de Nequi.

---

## 5. Siguiente paso — iniciar el trámite antes de programar

Igual que con la LLC, el trámite es el camino crítico. Con Wompi:

1. Registro en `comercios.wompi.co`.
2. Reunir **documento de identidad + RUT** en estado ACTIVO, con marca de agua
   "CERTIFICADO / DOCUMENTO SIN COSTO", legible, sin clave de apertura y a
   nombre del titular que hace el registro. Si es persona jurídica, sumar
   cámara de comercio.
3. **Verificar el bloqueante real: la cuenta de dispersión debe ser
   Bancolombia o Nequi**, a nombre del titular. Si UVA no la tiene, abrirla es
   el primer paso y probablemente el más lento.
4. Aprobación estimada: 1–3 días hábiles.
5. En paralelo, pedir llaves de **sandbox** — no requieren que el trámite esté
   aprobado, así que la integración puede empezar de inmediato.

---

## Fuentes

- Wompi — ambientes y llaves: <https://docs.wompi.co/docs/colombia/ambientes-y-llaves/>
- Wompi — fuentes de pago (recurrencia): <https://docs.wompi.co/docs/colombia/fuentes-de-pago/>
- Wompi — requisitos de vinculación: <https://soporte.wompi.co/hc/es-419/sections/360003814313>
- ePayco — tarifas y medios: <https://epayco.com/tarifas/>
- ePayco — suscripciones: <https://docs.epayco.com/docs/descripcion-general-1>
- Mercado Pago — suscripciones: <https://www.mercadopago.com.co/developers/es/docs/subscriptions/overview>
- Mercado Pago — comisiones y plazos: <https://www.mercadopago.com.co/ayuda/costos-recibir-pagos-checkout_33399>
- PayU — pagos recurrentes (deprecated): <https://developers.payulatam.com/latam/es/deprecated/recurring-payments.html>
- Bold — API de pagos en línea: <https://developers.bold.co/pagos-en-linea>
- Comisiones Wompi (fuente secundaria, reconfirmar): <https://mentoracolombia.com/pasarelas-de-pago-colombia-2026-comisiones-wompi-bold-mercadopago/>
