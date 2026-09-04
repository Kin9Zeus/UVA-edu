# Monitoreo, alertas, respaldo de base de datos y plan de reversión

Registro de avance de la tarea "Monitoreo, alertas, respaldo de base de
datos y plan de reversión". Se cierra módulo por módulo, con evidencia de
que cada uno se probó contra la base/el Sentry real — no solo que el código
compila.

## Estado por requisito

### Monitoreo

- [x] Seguimiento de errores (Sentry) en frontend y backend, con alertas —
  ya existía antes de esta tarea (P1-3, AUDIT-2026-08-24.md):
  `src/instrumentation.ts`, `src/instrumentation-client.ts`,
  `src/app/global-error.tsx`, `src/app/error.tsx`, `src/lib/log.ts`.
- [x] Registro estructurado sin datos personales ni tokens — `src/lib/log.ts`
  redacta por nombre de llave antes de mandar a Sentry y a consola (Módulo
  3, ver detalle abajo).
- [x] Chequeo de disponibilidad del sitio cada pocos minutos — `GET /api/health`
  (Módulo 2, ver detalle abajo). La parte de "un servicio externo le pega
  cada pocos minutos" queda documentada en `docs/ops/uptime-monitoring.md`
  pero requiere que alguien cree la cuenta del monitor — no se puede hacer
  desde el repo.
- [x] **Alerta específica si falla el webhook de Mux** — `scripts/mux-verificar-atascados.ts`
  + `.github/workflows/mux-monitor.yml` (Módulo 1, ver detalle abajo).

### Respaldos

- [ ] Confirmar respaldos automáticos de Supabase y su frecuencia real —
  pendiente, requiere el dashboard de Supabase (Módulo 4).
- [ ] Probar una restauración en un proyecto aparte — pendiente (Módulo 4).
- [ ] Documentar tiempo de restauración y pérdida de datos en el peor caso —
  pendiente (Módulo 4).

### Plan de reversión

- [ ] Todo pendiente (Módulo 5): pasos de rollback en Railway, criterios de
  reversión, política de migraciones hacia atrás, quién decide.

### Requisitos de calidad

- [ ] Alertas a un canal que el equipo mira (Slack/WhatsApp) — pendiente,
  vive en el dashboard de Sentry (Módulo 6).
- [ ] Umbral de ruido definido — pendiente (Módulo 6).

### Definición de "terminado"

Sin cumplir todavía: falta provocar el error en staging (no hay staging
separado — mismo caso que `docs/qa/bugs-e2e.md`), restaurar un respaldo de
verdad, y escribir + hacer seguir el plan de reversión por otra persona.

---

## Módulo 1 — Alerta si un video se queda atascado en Mux

**Problema real, no solo el enunciado de la tarea:** el enum
`EstadoProcesamientoLeccion` (`prisma/schema.prisma`) tiene SUBIENDO,
PROCESANDO, LISTO, ERROR, pero **ningún camino del código actual escribe
PROCESANDO** — `src/actions/admin/mux.ts` solo pone `SUBIENDO` al pedir el
Direct Upload, y `src/app/api/webhooks/mux/route.ts` solo escribe
LISTO/ERROR cuando Mux manda un evento. El estado que de verdad se queda
colgado si el webhook nunca llega es `SUBIENDO`, no `PROCESANDO` — el
chequeo vigila ambos.

**Falso positivo encontrado y corregido antes de confiar en el script:**
`estado_procesamiento` arranca en `SUBIENDO` por defecto desde que se crea
la lección (antes de que nadie pida ningún upload). La primera corrida
contra la base real reportó 25 lecciones "atascadas" que en realidad eran
filas de seed sin ningún video real. Se agregó el filtro
`id_mux_upload_id IS NOT NULL` (solo se llena al pedir el Direct Upload de
verdad) y se reverificó: 0 falsos positivos contra la base real.

**Qué se agregó:**
- `scripts/mux-verificar-atascados.ts` — consulta lecciones en
  SUBIENDO/PROCESANDO con `id_mux_upload_id` no nulo y `actualizado_en` más
  viejo que `MUX_ATASCADO_UMBRAL_MINUTOS` (default 120 min). Si encuentra
  alguna, llama `Sentry.captureMessage` (con `Sentry.flush` antes de salir,
  para no perder el evento al terminar el proceso) y sale con código 1.
- `npm run mux:verificar-atascados`.
- `.github/workflows/mux-monitor.yml` — job programado (`schedule`, cada 30
  min) + `workflow_dispatch`. Workflow **separado** de `ci.yml` a propósito:
  un `schedule:` en el `on:` de `ci.yml` dispararía también `checks`/`rls`
  (sus `if` solo distinguen push/PR, no `schedule`), multiplicando el golpe
  al Auth rate limit de Supabase que ya documentó BUG-002
  (`docs/qa/bugs-e2e.md`) sin necesidad — este chequeo es de solo lectura.

**Verificado end-to-end, no solo localmente:**
1. `npm run mux:verificar-atascados` corrido contra el proyecto real de
   Supabase antes del fix del filtro → 25 falsos positivos, confirmando que
   la consulta y la alerta SÍ disparan.
2. Mismo comando después del fix → `✅ Ninguna lección lleva más de 120 min
   en SUBIENDO/PROCESANDO.` (0 resultados, correcto).
3. El evento de la corrida #1 se confirmó en Sentry vía MCP
   (`uva-dh.sentry.io`, issue `UVA-EDU-1A`, `search_events`) — no fue solo
   un `eventId` local sin enviar. Se marcó `resolved` con una nota
   explicando que fue el falso positivo de la prueba, no un incidente real.

**Limitación conocida, no resuelta en este módulo:** el workflow usa
`environment: supabase-test` (el mismo que `rls`/`e2e` en `ci.yml`) — hoy
vigila el proyecto de **prueba**, no producción. Para vigilar producción de
verdad hace falta un `environment` de GitHub con las credenciales reales de
Supabase y el DSN de Sentry de producción, y apuntar el job a él. También
depende de que el secret `SENTRY_DSN` exista en ese environment de GitHub —
no se pudo confirmar desde el repo (sin `gh` CLI disponible en esta
máquina); sin él, el SDK no envía nada pero el job igual falla (código 1) y
queda como señal en GitHub Actions.

## Módulo 2 — Chequeo de disponibilidad del sitio

**Decisión consultada, no asumida:** CLAUDE.md dice que las Route Handlers
(`/api/`) están reservadas "únicamente" para webhooks de Stripe/Wompi/Mux.
Un healthcheck no es un webhook, así que antes de crear
`src/app/api/health/route.ts` se le preguntó al usuario si prefería
monitorear una página pública existente (cero código nuevo, respeta la
regla al pie de la letra) o crear el endpoint dedicado como excepción
documentada. Se eligió el endpoint dedicado — la excepción quedó anotada en
`CLAUDE.md` §3.1 y en el comentario de `src/lib/supabase/admin.ts`.

**Qué se agregó:**
- `GET /api/health` (`src/app/api/health/route.ts`, sin autenticación):
  confirma con una consulta real (`categorias`, vía `createAdminClient`)
  que Supabase responde — no solo que el proceso de Next.js sigue vivo — y
  que las variables de Mux/Resend existen (solo presencia, no llamada de
  red, para no gastar cuota de esos servicios en cada ping). `200` si todo
  bien, `503` si algo falla; si falla, registra el error completo en Sentry
  vía `logError` pero **nunca en la respuesta pública** (ver hallazgo de
  seguridad abajo).
- `docs/ops/uptime-monitoring.md` — guía para conectar UptimeRobot/BetterUptime
  a esta URL. Crear la cuenta y configurarla es responsabilidad de quien
  tenga acceso a facturación del equipo; no se puede hacer desde el repo ni
  desde esta sesión.

**Hallazgo de seguridad corregido antes de dar el módulo por bueno:** la
primera versión incluía el mensaje de error crudo de Supabase
(`supabase.error`) directo en el JSON de la respuesta pública — un endpoint
sin autenticación no debería filtrar detalles internos a quien le pegue. Se
movió ese detalle exclusivamente a los `extra` que recibe `logError` (solo
visible en Sentry), y la respuesta pública quedó reducida a
`{ ok: boolean }` por chequeo.

**Verificado end-to-end contra el entorno real, no solo leyendo el código:**
1. Servidor de dev levantado y `GET /api/health` probado con `curl` de
   verdad — no se asumió que compilaba y ya.
2. La primera corrida encontró un hallazgo real (no fabricado): a esta
   máquina de desarrollo le falta `RESEND_FROM_EMAIL` en `.env.local`
   (`RESEND_API_KEY` sí está) — el endpoint lo detectó correctamente y
   devolvió `503`. No se tocó `.env.local` (no es información que se deba
   inventar).
3. El evento de Sentry generado por esa falla real se confirmó vía MCP
   (`uva-dh.sentry.io`, issue `UVA-EDU-1B`) y se marcó `resolved` con nota
   explicando que es un vacío de este entorno local, no un incidente de
   producción.
4. Se reconfirmó tras el fix de seguridad que la respuesta pública ya no
   incluye el mensaje de error interno, y que el chequeo sigue detectando
   la variable faltante igual que antes.

**Limitación conocida:** el healthcheck vive en el mismo despliegue que
monitorea — si el proceso de Next.js entero está caído (no solo Supabase),
un monitor externo igual lo detecta porque no habrá respuesta HTTP en
absoluto (el `000`/timeout que ya se observó al probar contra un puerto sin
servidor levantado), así que ese caso sí queda cubierto sin necesitar el
endpoint. Sigue pendiente, como en el Módulo 1, decidir si esto debe vigilar
producción o el proyecto de prueba, y conectar el monitor externo de
verdad (Módulo 2 solo deja el endpoint y la guía listos).

## Módulo 3 — Higiene de PII/tokens en `logError`

**Auditoría de los ~50 llamados actuales, antes de tocar código:** se
revisó cada `logError(...)` del repo (auth, webhooks, certificados, admin,
comentarios, Mux) — ninguno pasa hoy una llave de `context` con forma de
dato personal o secreto. El log estructurado ya estaba limpio en la
práctica.

**Qué se agregó igual, como red de seguridad (no porque haya un caso real
hoy):** `src/lib/log.ts` ahora redacta por **nombre de llave** — no por
contenido de texto libre — antes de mandar `extra` tanto a
`Sentry.captureException` como al `console.error` estructurado. Cubre
llaves anidadas (objetos y arrays, hasta 3 niveles) para casos como
`{ usuario: { email } }` o `{ lecciones: [{ ... }] }`. Lista de patrones:
`email`, `correo`, `password`/`contrase`, `token`, `secret`,
`authorization`, `cookie`, `tarjeta`, `cvv`, `credito`, `cedula`,
`documento`, `telefono`/`phone`, `direccion`, `ssn`, `dni`.

**Decisión deliberada de NO tocar `error.message`:** el mensaje de la
excepción original (de Supabase/Mux/Resend) se deja intacto — redactar
texto libre por regex arriesga destruir la pista real de un bug sin
garantizar nada (un correo puede aparecer de mil formas distintas en un
mensaje de error). El alcance es la higiene de los campos *estructurados*
que la propia app decide loguear, no una promesa de que ningún dato
personal pueda aparecer jamás en Sentry — eso ya lo reconoce
AUDIT-2026-08-26.md como tema de la política de privacidad (P1-3), fuera
del alcance de este módulo.

**Verificado, no solo escrito:**
- `src/lib/log.test.ts` (nuevo): confirma que `correo`, `token` y una
  llave anidada (`usuario.email`, `lista[0].password`) se redactan, que
  llaves normales (`leccionId`, `area`, `usuario.nombre`) no se tocan, y
  que `error.mensaje` (la excepción original) se deja tal cual.
- `npm test` completo: **170/170** (168 preexistentes + 2 nuevos), nada
  se rompió.
- `npx tsc --noEmit`: sin errores en `log.ts` ni `log.test.ts`.
