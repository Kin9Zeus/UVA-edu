# Canal de alertas y umbral de ruido

Esto vive enteramente en el dashboard de Sentry — confirmado que el MCP de
Sentry conectado a esta sesión no puede leer ni crear reglas de alerta
para esta organización (la API de alert rules devuelve `410 Gone` en este
proyecto; ver `docs/qa/monitoreo-alertas-respaldos.md`, Módulo 1). No hay
forma de aplicar esto desde el código ni desde esta sesión — son pasos
para seguir a mano.

## Canal recomendado: Slack

El equipo (3 personas) hoy no usa ni Slack ni WhatsApp para esto. La
recomendación es **Slack**, no porque sea obligatorio, sino porque Sentry
tiene integración nativa (Settings → Integrations → Slack → conectar
workspace → elegir canal), sin pasos intermedios ni costo — el plan
gratuito de Slack no tiene ninguna limitación relevante para recibir
notificaciones en tiempo real. Un workspace de Slack se puede crear
específicamente para esto en un par de minutos, aunque el equipo no lo use
para nada más.

**Si más adelante prefieren WhatsApp en su lugar:** Sentry no tiene
integración nativa con WhatsApp. Necesitaría un puente (Sentry →
webhook → Zapier/Make → WhatsApp Business API, o similar) — más pasos y
probablemente un costo mensual del servicio puente. Queda como alternativa
documentada, no implementada.

## Reglas de alerta — umbral de ruido

El código ya trae un tag `area` en todo lo que pasa por `logError`
(`src/lib/log.ts`) y por los scripts de monitoreo — se puede usar tal cual
para separar "esto hay que verlo ya" de "esto se revisa cuando haya
tiempo", en vez de una sola regla que avise por todo.

**Regla 1 — Incidente de infraestructura (sin umbral, avisa al primer
evento):**
```
area IN (webhook, mux-atascado, health)
```
Estas tres ya representan una falla detectada por un chequeo automático —
un webhook con firma inválida o sin registrar, un video atascado
(`scripts/mux-verificar-atascados.ts`, Módulo 1), o `/api/health` en
`503` (Módulo 2). No son ruido de un usuario aislado: si aparecen, algo de
infraestructura está fallando de verdad.

**Regla 2 — Todo lo demás (con umbral, para no despertar a nadie por un
caso aislado):**
```
NOT area IN (webhook, mux-atascado, health)
```
Notificar solo si el mismo issue ocurre **5 veces en 10 minutos** (punto
de partida — ajustar con la experiencia real de las primeras semanas). Un
error que le pasa una vez a un usuario con una conexión rara no necesita
sacar a nadie de lo que esté haciendo; el mismo error repitiéndose sí.

**Umbral de ruido, en una frase:** si es un fallo de infraestructura
(webhook/Mux/salud del sitio), avisa siempre y de inmediato; si es
cualquier otro error de la aplicación, avisa solo cuando se repite.

## Pasos en el dashboard (Sentry → Alerts)

1. Conectar la integración de Slack (Settings → Integrations).
2. Alerts → Create Alert Rule → proyecto `uva-edu`.
3. Crear la Regla 1 con el filtro `area` de arriba, acción "Send a Slack
   notification", sin condición de frecuencia.
4. Crear la Regla 2 con el filtro negado, acción igual, condición
   "issue is seen more than 5 times in 10 minutes".
5. Verificar con un error de prueba (`docs/qa/monitoreo-alertas-respaldos.md`
   ya documenta cómo se dispararon issues reales de prueba en los Módulos
   1 y 2 — el mismo patrón sirve para confirmar que la Regla 1 llega a
   Slack).

## Fase 6 del plan de blindaje (2026-11-04)

El plan pide alertas para tres cosas. Cómo queda cada una:

| Qué | Dónde se vigila | Estado |
| --- | --- | --- |
| Pico de errores | Sentry, regla **"Pico de errores"**: WHEN un evento nuevo de un issue; IF (all) *Number of events* más de 5 en 10 minutos y `area` distinta de webhook, mux-atascado y health; THEN notificar; Throttling **1 hora** (sin eso llega un correo por cada evento del pico) | **Creada 2026-11-04.** Hoy el equipo recibe por **correo** (un solo miembro en Sentry), no por Slack: en el paso 3 y 4, la acción es "Notify on preferred channel" |
| Fallos de webhooks | Sentry, regla **"Falla de infraestructura"**: WHEN issue nuevo o issue resuelto que regresa; IF (any) `area` = webhook, mux-atascado o health; THEN notificar | **Creada 2026-11-04.** El código ya manda `area: "webhook"` en cada fallo de firma, de registro o de proceso |
| Pico de respuestas 403 y 429 | **Cloudflare**, no Sentry: Notifications → *Security Events Alert* (`docs/ops/cloudflare.md`, sección 2.8) | Al poner Cloudflare. Los 403 del cierre del origen y los 429 del límite de acceso ocurren en el borde |

Por qué los rechazos por límite no van a Sentry: los límites de uso de la
base (`supabase/sql/134_limites_uso.sql`) frenan a un bot en cada intento,
y mandar un evento por intento gastaría la cuota del plan gratuito de
Sentry justo durante un ataque, dejando sin registrar los errores reales.
La tabla `private.limites_uso` guarda los usos que pasaron (dos días), no
los rechazos: sirve para ver quién llegó al tope, no cuántas veces insistió.

La alerta de acciones sensibles del panel (`area=alerta-admin`, fase 7) ya
está creada.
