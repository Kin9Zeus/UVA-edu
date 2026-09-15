# Plan — Transmisiones en vivo ("Eventos")

> Estado: **planeado, no implementado**. Este documento es la referencia única antes de tocar código — reemplaza cualquier discusión anterior sobre el tema.

## 1. Diagnóstico

No existe nada de esto en el proyecto hoy — ni en `functional-spec.md`/`development-plan.md`, ni en `schema.prisma`, ni en código. Se construye sobre infraestructura que ya está:

- **Mux** ya soporta live streaming nativamente (`@mux/mux-node ^14.1.1` trae `video.liveStreams.create/retrieve/update/delete/complete/createPlaybackId`) — mismas API keys que ya usan las lecciones (`MUX_TOKEN_ID`, `MUX_TOKEN_SECRET`, `MUX_SIGNING_KEY_ID`, `MUX_SIGNING_KEY_PRIVATE`), sin dependencias nuevas.
- El patrón de **acceso por suscripción** (`obtenerAccesoAlCurso`, `tieneAccesoVigente`), **notificaciones** (`Notificaciones`, tipo acotado por CHECK), **webhooks idempotentes** (`EventosWebhook` + `registrarEvento`/`marcarProcesado`) y **reproductor firmado** (`src/lib/mux/*`, `VideoPlayer.tsx`) ya están construidos.
- Lo único genuinamente nuevo: el **chat en vivo** y el **scheduler** (no hay cron en el proyecto hoy).

## 2. Decisiones ya cerradas

| Tema | Decisión | Por qué |
|---|---|---|
| Plataforma de video | Mux (no Zoom) | `functional-spec.md` ya declara como meta migrar de "sesiones en vivo" externas a un reproductor propio; Zoom rompería el control de acceso propio, la marca y el pipeline de grabación existente. |
| Latencia de video | `latency_mode: 'low'` (LL-HLS, ~5s) | Con `'standard'` (~30-45s) el chat quedaría desincronizado del video. |
| Motor de chat | Supabase Realtime **Broadcast** (no *Postgres Changes*) | *Postgres Changes* ya se probó en este proyecto y se retiró por costo — reevalúa RLS por fila y por suscriptor, ver comentario en `CodigosPanel.tsx` y `AUDIT-2026-09-08-base-de-datos.md` (D-13). Broadcast es pub/sub efímero sobre WebSocket, sin ese costo. |
| Plan de Supabase | **Free**, por ahora | Suficiente mientras la audiencia simultánea por evento sea moderada (tope: 200 conexiones concurrentes / 2M mensajes-mes). Revisar antes de anunciar un evento a toda la base de suscriptores. |
| Filtro de chat | Automático, por lista de palabras, **rechaza el mensaje** (no censura con asteriscos) | Más simple y evita contenido ofensivo a medias; mismo patrón de error inline que ya usa `calificarCurso`. |
| Visibilidad del chat en la grabación | Oculto por defecto, colapsable | El chat en vivo es ruido con contexto de tiempo real; queda guardado para quien igual quiera verlo. |

## 3. Modelo de datos (Fase A)

```prisma
model Eventos {
  id                     String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  titulo                 String
  descripcion            String?
  id_instructor          String?       @db.Uuid   // Perfiles rol PROFESOR — bypass de acceso Y de moderación
  imagen_portada_url     String?
  inicia_en              DateTime      @db.Timestamptz  // capturado/mostrado siempre en América/Bogotá
  duracion_estimada_min  Int?
  estado                 EstadoEvento  // PROGRAMADO | EN_VIVO | FINALIZADO | CANCELADO
  id_mux_live_stream_id  String?       @unique
  id_mux_stream_key      String?       // nunca en el select general del CMS, solo vía Server Action dedicada + admin
  id_video_mux_en_vivo   String?
  id_video_mux_grabacion String?       // null = "grabación en preparación" aunque estado ya sea FINALIZADO
  ultimo_idle_en         DateTime?     @db.Timestamptz  // idle NO cambia `estado`, solo esto; el cron decide
  requiere_suscripcion   Boolean       @default(true)   // MVP: incluido en la suscripción, ver §7 Pendientes
  publicado              Boolean       @default(false)
  creado_por             String        @db.Uuid
  creado_en              DateTime      @default(now()) @db.Timestamptz
  actualizado_en         DateTime      @updatedAt @db.Timestamptz
}

model EventoInscripciones {
  // Solo RSVP/intención (recordatorios, contador) — NUNCA fuente de acceso.
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  id_evento   String   @db.Uuid
  id_usuario  String   @db.Uuid
  creado_en   DateTime @default(now()) @db.Timestamptz
  @@unique([id_evento, id_usuario])
}

model EventoChatMensajes {
  // Historial persistido. RLS: lectura para quien tiene acceso VIGENTE
  // (obtenerAccesoAlEvento, no "está inscrito"). Oculto por defecto en la
  // UI de la grabación, ver tabla de decisiones.
}

model PalabrasFiltradas {
  // Lista administrable (palabra, activo, creado_por) — CRUD desde el
  // mismo CMS de eventos, no un módulo aparte.
}
```

Migración SQL adicional obligatoria: extender el CHECK `notificaciones_tipo_valido` (mismo patrón de `supabase/sql/131_comunidad_reporte_resuelto_con_veredicto.sql`: `drop constraint` + `add constraint` con la lista ampliada) para sumar `'EVENTO_PROXIMO'`. **No es gratis** — a diferencia de lo que se pensó en un borrador anterior, `notificaciones.tipo` no es texto libre de verdad, tiene un CHECK explícito.

## 4. Control de acceso

`obtenerAccesoAlEvento` — análoga a `obtenerAccesoAlCurso` (`src/lib/accesoCurso.ts`), **no una reutilización literal** (esa función está acoplada a `cursoId`). Resuelve en cada request:

- Suscripción vigente (`tieneAccesoVigente`, misma función que ya usan cursos), **o**
- `id_usuario = Eventos.id_instructor` (bypass, igual que `esInstructorDelCurso`).

Es el único punto de verdad para tres cosas: reproducción del video, autorización del canal de chat, y **moderación** — moderar no puede depender solo de `esAdmin` porque PROFESOR es un rol distinto de ADMINISTRADOR en el enum `RolPerfil` de este proyecto; la regla real es `esAdmin || esInstructorDelEvento`.

`EventoInscripciones` **nunca** es la fuente de este chequeo — solo RSVP. Si lo fuera, reaparecería la misma clase de bug que ya se corrigió una vez para cursos (P0-1, `AUDIT-2026-08-26.md`: una fila de acceso que sobrevive al vencimiento real de la suscripción).

## 5. Máquina de estados de Mux (Fase B)

- `video.live_stream.active` → `estado = EN_VIVO` (idempotente).
- `video.live_stream.idle` → **no toca `estado`**, solo escribe `ultimo_idle_en = now()`. Mux manda `idle` en cualquier corte de conexión, incluidos los transitorios dentro del `reconnect_window` — pasar a `FINALIZADO` de inmediato causaría parpadeo de estado y desmontaría el chat de todos los espectadores por una reconexión de segundos.
- Botón admin **"Terminar transmisión"** (`liveStreams.complete()`) → `estado = FINALIZADO`.
- Cron de seguridad (Fase E, red de respaldo): si `estado = EN_VIVO` y `ultimo_idle_en` es más viejo que `reconnect_window + margen` sin un `active` después, recién ahí pasa a `FINALIZADO` — cubre el caso de que el admin se olvide del botón.
- `video.asset.ready` (identificado por `live_stream_id`, no `upload_id`) → solo llena `id_video_mux_grabacion`. La UI decide "grabación en preparación" vs "disponible" mirando si esta columna tiene valor, **no** el `estado` — el asset de la grabación tarda en procesarse después de que el stream ya terminó.
- Botón admin **"Regenerar stream key"** (`resetStreamKey`) para el caso de filtración.
- `src/lib/video/reproduccion.ts` (`resolverTokenReproduccion`) **no es reutilizable tal cual** — está codeada específicamente contra `lecciones`/`modulos`. Se escribe un `resolverTokenReproduccionEvento` propio, reutilizando solo el mecanismo de firma (`mux.jwt.signPlaybackId`, `VideoPlayer.tsx`).

## 6. Chat (Fase D)

- Canal privado `evento:<id>` vía **Broadcast Authorization** (políticas RLS sobre `realtime.messages`, autorizan solo a quien `obtenerAccesoAlEvento` aprueba).
- Envío de mensajes por **Server Action** (nunca directo cliente→canal): valida acceso → filtro automático de palabras (`PalabrasFiltradas`, rechaza el mensaje completo con error inline) → rate-limit por cooldown (**lógica nueva** — no existe rate-limit en ningún lugar de Comunidad hoy, verificado) → inserta en `EventoChatMensajes` → emite el broadcast por el **endpoint REST** de Supabase (`POST /realtime/v1/api/broadcast`), no abriendo un socket dentro de la Server Action — un socket por mensaje gastaría cupo de las 200 conexiones concurrentes del plan Free en algo que dura milisegundos.
- `id_mux_stream_key` y cualquier dato sensible del stream nunca viajan en el `select` general que arma la tabla del CMS — se exponen solo mediante una Server Action dedicada que valida admin explícitamente.

## 7. Notificaciones + scheduler (Fase E)

- `Notificaciones` con `tipo = 'EVENTO_PROXIMO'` (con su migración de CHECK, ver §3).
- `pg_cron`: recordatorios T-24h/T-1h, más el cron de seguridad de `ultimo_idle_en` (§5).
- Evento que nunca arrancó (`inicia_en` + margen, sigue `PROGRAMADO`): no se auto-cancela de inmediato — se notifica al admin y queda en `PROGRAMADO` para acción manual; auto-`CANCELADO` solo como limpieza tardía.

## 8. Testing (Fase F)

- `npm run test:rls` cubre las tablas normales nuevas (`Eventos`, `EventoInscripciones`, `EventoChatMensajes`, `PalabrasFiltradas`) con el mismo arnés de 3 cuentas que ya usa el proyecto.
- Prueba **nueva y separada**: abrir un socket real contra el canal `evento:<id>` con cada una de esas cuentas y verificar que la suscripción se acepta o se rechaza según corresponda — el arnés actual de `test:rls` solo ejercita CRUD normal, no Broadcast Authorization.

## 9. Pendiente (explícitamente sin decidir — no bloquea el orden de construcción)

1. **Modelo de cobro**: aún no se sabe si el acceso a un evento irá incluido en la suscripción activa, o si se venderá aparte por evento (pago adicional). El campo `Eventos.requiere_suscripcion` ya queda preparado en el esquema para no requerir una migración destructiva el día que se decida. **Por ahora el MVP fija el acceso a "incluido en la suscripción activa"**, mismo umbral que un curso.
2. **Cupo máximo de inscritos**: sin límite por ahora. Si se decide un tope, cambia la Server Action de inscripción de un insert simple a un chequeo de cupo bajo transacción.

## 10. Orden de construcción

Fase A (esquema + RLS) → Fase B (Mux plumbing) → Fase C (CMS admin: CRUD, control de transmisión, regenerar key, moderación) → Fase D (experiencia del estudiante + chat) → Fase E (notificaciones/scheduler) → Fase F (testing).
