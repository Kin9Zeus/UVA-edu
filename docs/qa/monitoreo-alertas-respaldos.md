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
  procedimiento listo en `docs/ops/respaldos-y-restauracion.md` (Parte A),
  falta que alguien con acceso al dashboard lo llene (Módulo 4).
- [ ] Probar una restauración en un proyecto aparte — procedimiento listo
  (Parte B), falta ejecutarlo (Módulo 4). No se puede hacer desde esta
  sesión: se ofreció conectar el MCP de Supabase para intentarlo con
  acceso real y se decidió no hacerlo por ahora.
- [ ] Documentar tiempo de restauración y pérdida de datos en el peor caso —
  plantilla de resultados y análisis del peor caso listos (Parte B/C),
  falta llenar los números reales tras correr el simulacro (Módulo 4).

### Plan de reversión

- [x] Pasos de rollback en Railway, criterios de reversión, política de
  migraciones hacia atrás (con chequeo automático en CI) y quién decide —
  `docs/ops/plan-de-reversion.md` (Módulo 5, ver detalle abajo).

### Requisitos de calidad

- [ ] Alertas a un canal que el equipo mira (Slack/WhatsApp) — especificación
  lista en `docs/ops/canal-alertas.md`, falta que alguien la aplique en el
  dashboard de Sentry (Módulo 6).
- [ ] Umbral de ruido definido — definido en `docs/ops/canal-alertas.md`
  (Módulo 6): infraestructura (`webhook`/`mux-atascado`/`health`) avisa
  siempre, todo lo demás solo si se repite 5 veces en 10 min.

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

## Módulo 4 — Runbook de respaldos y simulacro de restauración

**Por qué no se ejecutó, no solo se documentó:** confirmar el plan de
respaldos y correr un simulacro de restauración requiere acceso al
dashboard/organización de Supabase (crear un proyecto nuevo, restaurar un
respaldo sobre él) — nada de eso es alcanzable desde el código ni desde
consultas de solo lectura con la Service Role Key del proyecto actual. Se
le ofreció al usuario conectar el MCP de Supabase (OAuth) para intentar
esto con acceso real a la API de gestión, y se decidió explícitamente no
hacerlo por ahora — queda como runbook para ejecutar a mano.

**Qué se agregó:** `docs/ops/respaldos-y-restauracion.md`, con tres partes:
- **Parte A** — qué anotar del dashboard (plan, tipo de respaldo,
  retención real, hora del último respaldo). Deliberadamente no incluye
  cifras de retención por plan de Supabase: cambian con el tiempo, y lo
  único que vale es lo que el panel muestre para este proyecto en el
  momento en que alguien lo revise.
- **Parte B** — el simulacro paso a paso (crear proyecto nuevo → restaurar
  → `npm run prisma:deploy` → `npm run db:rls` → `npm run test:rls`),
  con una tabla para llenar con los resultados reales (RTO, RPO, si
  `test:rls` pasó). El paso que de verdad importa no es que los datos
  vuelvan — es que `test:rls` pase, porque una base restaurada vuelve
  con sus tablas pero sin ninguna de las ~69 políticas de RLS (viven en
  `supabase/sql/`, no en el respaldo de datos).
- **Parte C** — qué se pierde en el peor caso con respaldos diarios sin
  PITR (progreso de video, códigos canjeados y cuentas creadas ese día,
  comentarios, certificados, eventos de webhook sin reflejar).

**Estado:** documento listo y consistente con los scripts reales del repo
(`prisma:deploy`, `db:rls`, `test:rls` verificados contra `package.json`).
Los tres checkboxes de "Respaldos" siguen sin marcar hasta que alguien con
acceso al dashboard de Supabase corra el procedimiento y llene la tabla de
resultados — esto es trabajo pendiente fuera del repo, no una tarea que
este módulo pueda cerrar por sí solo.

**Actualización:** el usuario confirmó que todavía no hay un plan de
Supabase con respaldos automáticos reales configurado — este módulo queda
explícitamente en espera hasta que eso exista, no es un olvido.

## Módulo 5 — Plan de reversión (Railway) + migraciones reversibles

**Limitación de partida, igual que en el Módulo 4:** no existe todavía
ningún proyecto de Railway ni archivo de configuración en el repo (sin
`railway.json`, sin `Procfile`) — los pasos exactos del dashboard de
Railway se documentan de forma genérica (Railway revierte redesplegando un
build anterior desde *Deployments*) y quedan marcados para confirmar la
primera vez que exista un despliegue real.

**Qué sí se pudo cerrar del todo, con dientes en CI:**
- `docs/ops/plan-de-reversion.md` — cómo revertir en Railway y tiempo
  estimado, criterios concretos de "revertir ya" vs. "arreglar en
  caliente" (la pregunta que decide: ¿alguien no puede completar el
  recorrido crítico ahora mismo?), la regla de migraciones hacia atrás, y
  quién decide (Aleck, tal como especifica la tarea).
- `scripts/verificar-migraciones-reversibles.ts` + `npm run
  verificar:migraciones-reversibles` — compara las migraciones nuevas de
  la rama contra `origin/master` y falla si alguna agrega un `DROP
  COLUMN`/`DROP TABLE`/`RENAME COLUMN`/`RENAME TABLE`. Solo mira líneas
  **agregadas** del diff, para no reventar por un DROP que ya existía de
  antes de esta regla.
- Enganchado en el job `checks` de `ci.yml` (corre en cada PR, sin
  secretos) — se agregó `fetch-depth: 0` al checkout de ese job, necesario
  para que el diff de tres puntos contra `origin/master` tenga la historia
  común disponible.

**Verificado, no solo escrito:**
1. `npm run verificar:migraciones-reversibles -- origin/master` contra el
   estado real de la rama → pasa limpio (ninguna migración existente viola
   la regla).
2. **Caso positivo probado de verdad:** se creó una migración de prueba
   con `DROP COLUMN`, se comiteó temporalmente, se corrió el chequeo →
   detectó el `DROP COLUMN` exacto y salió con código 1. Se deshizo el
   commit (`git reset --soft` + borrar el archivo) antes de continuar —no
   quedó rastro en el historial.
3. `npm test` completo tras el cambio: **170/170**. `tsc --noEmit`: sin
   errores.

**Limitación conocida:** el chequeo de CI depende de que `fetch-depth: 0`
realmente traiga `origin/master` al runner — es el comportamiento
documentado de `actions/checkout`, pero no se pudo observar una corrida
real en GitHub Actions todavía (mismo tipo de brecha que ya quedó anotada
para el job `e2e` del Módulo 1: probado localmente y razonado contra la
documentación, no contra una ejecución real del workflow).

## Módulo 6 — Canal de alertas y umbral de ruido

**Confirmado que esto no se puede hacer desde el código ni desde esta
sesión, no solo asumido:** se intentó usar el MCP de Sentry para leer/crear
reglas de alerta de verdad (`find_alert_rules`/`get_alert_rule` vía
`execute_sentry_tool`) — la API devuelve `410 Gone` para esta organización
(la misma limitación ya encontrada en el Módulo 1). Sí se confirmó que el
MCP puede crear un **monitor de uptime nativo de Sentry**
(`create_uptime_monitor`) — una alternativa a UptimeRobot/BetterUptime del
Módulo 2 que viviría en el mismo dashboard que ya usan — pero no tiene
sentido crearlo todavía: no hay ninguna URL de producción real (sin
Railway desplegado, Módulo 5). Queda anotado para cuando exista.

**Decisión consultada, no asumida:** se le preguntó al usuario si el
equipo ya usa Slack o WhatsApp — ninguno de los dos todavía. Se recomienda
Slack (integración nativa de Sentry, gratis, sin pasos intermedios) sobre
WhatsApp (necesitaría un puente tipo Zapier/Make, con costo y pasos
extra), dejando WhatsApp documentado como alternativa si el equipo prefiere
eso después.

**Qué se agregó:** `docs/ops/canal-alertas.md` — el umbral de ruido
concreto, no una idea abstracta: usa el tag `area` que Módulos 1-3 ya
escriben en cada `logError`/alerta (`webhook`, `mux-atascado`, `health`,
`email`, `rate-limit`, `certificados`) para separar dos reglas — fallos de
infraestructura (`webhook`/`mux-atascado`/`health`) avisan siempre y de
inmediato, cualquier otro error solo avisa si se repite 5 veces en 10
minutos. Incluye los pasos exactos de Sentry → Alerts para aplicarlas.

**Estado:** especificación lista y accionable; falta que alguien con
acceso al dashboard de Sentry la aplique (conectar Slack, crear las 2
reglas) y falta el monitor de uptime nativo hasta que haya una URL de
producción real.
