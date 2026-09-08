# Auditoría RLS y fuga de contenido — Fase 7

Fecha: 2026-09-03
Responsable: JuanMiguel (ejecutado con Claude Code)
Alcance: `Revision.md` — RLS, fuga de contenido (Mux), secretos.
Entorno probado: proyecto Supabase único (`eoewtxnheblzsspnubvt`) — sin datos
reales de producción todavía (ver hallazgo F-1).

## Resumen

| Bloque | Estado |
|---|---|
| RLS | ✅ 124/124 pruebas automatizadas OK (`npm run test:rls`) |
| Fuga de contenido (Mux) | ✅ Verificado con llamadas reales a la API de Mux |
| Secretos | ✅ Ninguno expuesto en bundle ni en historial de git |
| Separación staging/producción | ❌ No existe — ver F-1 (P1) |

Ningún hallazgo P0 abierto.

## 1. Auditoría de RLS

### 1.1 Cobertura tabla por tabla

Las 24 tablas del schema Prisma tienen `ENABLE ROW LEVEL SECURITY` (verificado
contra `supabase/sql/001...057`). Ninguna tabla queda sin RLS habilitado. Las
tablas sin `CREATE POLICY` explícita quedan sin ningún acceso para `anon`/
`authenticated` por diseño — solo el cliente `service_role` (uso exclusivo
server-side, `src/lib/supabase/admin.ts`) las salta.

### 1.2 Prueba con tres sesiones (anónimo / sin acceso / con acceso)

`scripts/rls-test.ts` (`npm run test:rls`) ya implementaba esta prueba desde
Fase 1, llamando la API de Supabase directamente (no la UI), con creación y
limpieza de usuarios/curso desechables. Se corrió contra el proyecto actual:

```
124/124 pruebas OK.
```

Incluye, entre otras: lectura cruzada de `perfiles`, `progreso`,
`certificados`, `suscripciones`, `cupones`, `codigos_invitacion`,
`bitacora_administrativa`, `eventos_webhook`, `tokens_vista_previa`; RPCs
`SECURITY DEFINER` solo invocables por `service_role` o por admin
(`canjear_codigo_invitacion`, `admin_listar_usuarios`,
`cerrar_suscripcion_caducada_admin`, `crear_lote_codigos_invitacion`, etc.);
casos de vigencia por fecha, revocación de cortesía/membresía, y consistencia
del panel de administración.

### 1.3 Auto-promoción de rol a ADMINISTRADOR

Cubierto (ya existía): `estudiante sin acceso NO puede auto-promoverse a
ADMINISTRADOR` y el mismo caso para el estudiante con acceso — ambos
bloqueados por `013_perfiles_bloquea_autopromocion.sql`. ✅

### 1.4 Crear/editar/borrar contenido desde una cuenta de estudiante

**Hueco identificado y cerrado en esta auditoría.** El script no tenía ninguna
prueba de escritura directa sobre `cursos`/`modulos`/`lecciones` desde una
sesión de estudiante. Se agregaron 12 casos nuevos (`scripts/rls-test.ts`):
INSERT/UPDATE/DELETE sobre las tres tablas, probados tanto con un estudiante
sin acceso como con uno con suscripción ACTIVA pagando — para confirmar que
pagar tampoco otorga permisos de escritura sobre el catálogo. Los 12 casos
pasan, bloqueados por `014_separa_politicas_for_all.sql`
(`cursos_admin_insert/update/delete`, `modulos_admin_*`, `lecciones_admin_*`).

### 1.5 Funciones `SECURITY DEFINER`

Se revisaron las 30+ funciones `SECURITY DEFINER` del proyecto
(`supabase/sql/*.sql`). Todas fijan `search_path` explícito (`public`, `auth`
o `private`) — ninguna vulnerable a *search_path hijacking*. Las que exponen
lógica sensible (`es_administrador()`, `correo_verificado()`) viven en el
schema `private`, no expuesto por PostgREST como RPC.

## 2. Auditoría de fuga de contenido (Mux)

### 2.1 Política `signed` en el 100% de los assets

Se listaron los assets reales vía API de Mux (no solo el código de la app, que
solo puede garantizar `signed` en el flujo de subida propio):

```
Total assets: 5
Assets sin política 100% signed: 0
```

### 2.2 Reproducción sin token

Se tomó un `playback_id` real (`status: ready`) y se pidió sin token:

```
GET https://stream.mux.com/{playback_id}.m3u8   -> HTTP 403
GET https://image.mux.com/{playback_id}/thumbnail.jpg -> HTTP 403
```

### 2.3 Expiración del token

Se firmó un JWT con el mismo cliente de Mux que usa la app
(`src/lib/mux/client.ts`, `expiration: "15m"`) y se decodificó:

```
exp - ahora ≈ 14.9 minutos
GET .../{playback_id}.m3u8?token=... -> HTTP 200
```

Consistente con `DURACION_TOKEN = "15m"` en `src/lib/video/reproduccion.ts:12`.

### 2.4 Revocar acceso corta la emisión de tokens nuevos

Ya cubierto por `scripts/rls-test.ts` con el flujo real de la app (no
simulado): cortesía revocada y membresía manual revocada dejan de obtener
token (`resolverTokenReproduccion` devuelve error, no token). El token ya
emitido antes de revocar sigue siendo válido hasta sus ~15 min — es la
mitigación aceptada, documentada en el propio código.

## 3. Auditoría de secretos

### 3.1 Bundle del navegador

Grep de `.next/static` (bundle de producción) por las 5 claves sensibles
(`SUPABASE_SERVICE_ROLE_KEY`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`,
`MUX_SIGNING_KEY_PRIVATE`, `RESEND_API_KEY`) — nombres de variable **y**
fragmentos de sus valores reales (20 caracteres) tomados de `.env.local`:
0 coincidencias en ambos casos. Ninguna tiene prefijo `NEXT_PUBLIC_`.

### 3.2 Historial de git

```
git log --all --full-history -- .env .env.local .env.production
```
Sin resultados — nunca se commiteó un archivo `.env*`. Un `grep -p` sobre todo
el historial buscando asignaciones de las claves sensibles solo encontró
líneas vacías (`NOMBRE=`, plantillas de documentación), nunca un valor real.

### 3.3 `.env.example`

No existía — creado en esta auditoría (`.env.example`), documentando las 20
variables reales que usa `.env.local` (`docs/technical-spec.md §11` solo
listaba 14; faltaban `NEXT_PUBLIC_SITE_URL`, `RESEND_FROM_EMAIL`,
`SEND_EMAIL_HOOK_SECRET` — las tres correctamente sin prefijo público salvo la
primera, que es pública a propósito).

### 3.4 Staging vs. producción

Ver F-1 abajo.

## Hallazgos abiertos

### F-1 — Sin separación staging/producción (P1) — parcialmente resuelto 2026-09-03

**Qué estaba mal:** existía un único proyecto Supabase
(`eoewtxnheblzsspnubvt`), una sola configuración de Mux/Stripe. No había
entorno de staging aislado como describe `docs/technical-spec.md §10`.

**Por qué importa:** hoy es de bajo riesgo porque el proyecto original solo
tiene datos de prueba (confirmado con el usuario). Pero en cuanto haya
contenido real o el primer usuario pagando, cualquier prueba, migración o
script de este mismo tipo corre contra datos reales sin margen de error.

**Lo que se hizo (2026-09-03):**
- Se creó un segundo proyecto Supabase de staging (`tmvmthdwapegypveaosd`,
  región `us-west-2`, distinto al actual en `us-east-1`), credenciales
  guardadas en `.env.staging.local` (ignorado por git, nunca pegado en texto
  plano fuera de ese archivo).
- Se creó un environment nuevo en Mux para staging (token y signing key
  propios, rotados una vez por precaución tras quedar expuestos accidentalmente
  en un chat).
- Se aplicaron las 26 migraciones de Prisma + los 62 scripts de RLS
  (`npm run db:rls:check` y `db:rls`) contra el proyecto de staging.
- Se sembraron datos de prueba (`prisma db seed`, `ALLOW_SEED=true`).
- Se corrió `npm run test:rls` contra staging: **124/124 pruebas OK**.

**Pendiente:**
- Configurar el servicio de staging en Railway con estas mismas credenciales
  (no solo local) y actualizar `NEXT_PUBLIC_SITE_URL` con su URL real.
- Cuando exista producción real (con usuarios/pagos reales, no solo el
  proyecto único actual de desarrollo), sus credenciales deben vivir
  **únicamente** en las variables de entorno de Railway — nunca en un
  `.env.local` de una máquina de desarrollo, para que ningún script local
  pueda tocarla por accidente.

**Cómo verificar:** el checklist de esta sección — dos `NEXT_PUBLIC_SUPABASE_URL`
distintas, cada una con sus propias credenciales de Mux/Stripe — ya se cumple
para local/staging. Falta la verificación equivalente en Railway.

**Estado:** parcialmente resuelto. Ya no bloquea seguir con la Fase 7; queda
como tarea de infraestructura (Railway) antes de cargar contenido de
producción o abrir pagos reales.

## Definición de "terminado" (checklist original)

- [x] RLS habilitado tabla por tabla
- [x] Tres tokens, API directa, lecturas ajenas fallan
- [x] Auto-promoción a admin falla
- [x] Crear/editar/borrar contenido como estudiante falla (extendido en esta auditoría)
- [x] Script de Fase 1 reutilizado y ampliado
- [x] Política `signed` en 100% de assets Mux
- [x] Reproducción sin token falla (403)
- [x] Token capturado expira en la ventana esperada (~15 min)
- [x] Revocar acceso corta emisión de tokens nuevos
- [x] Sin claves sensibles en el bundle del navegador
- [x] Sin secretos en el historial de git
- [ ] Staging y producción con credenciales distintas — **F-1, abierto**

Ningún hallazgo de severidad crítica (P0) queda abierto.
