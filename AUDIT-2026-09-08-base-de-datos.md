# Auditoría de base de datos — U.V.A v2

**Fecha:** 2026-09-08
**Alcance:** capa de datos (PostgreSQL/Supabase): esquema, restricciones, índices,
RLS y funciones `SECURITY DEFINER`, vistas, triggers, migraciones, coste de
consulta, retención/borrado y supervivencia (respaldos).
**Profundidad:** `--deep` sobre el dominio de datos.
**Modo de acceso:** solo lectura. Toda consulta al proyecto se hizo con `SELECT`
o `EXPLAIN`; las simulaciones de rol corrieron dentro de `BEGIN READ ONLY … ROLLBACK`.
**Ninguna escritura, migración ni DDL se ejecutó.**
**Proyecto inspeccionado:** `eoewtxnheblzsspnubvt` (el mismo de `.env.local`).

> Esta auditoría **no** es la de 15 dominios. Cubre el dominio 2 (datos y
> persistencia) a profundidad, más la parte de seguridad que vive *dentro* de la
> base (RLS, RPC, vistas, permisos). Los dominios de aplicación, web, CI/CD,
> accesibilidad y privacidad de la interfaz siguen tal como los dejó
> `AUDIT-2026-09-04.md`; no los revisé aquí. Ver §7.

---

## 1. Ground Truth

| Pregunta | Hallado |
|---|---|
| ¿Qué es? | Postgres 17 en Supabase. 30 tablas en `public`, 6 tablas de rate-limit en `private`, 6 vistas, 2 buckets de Storage con RLS. |
| ¿Quién define el esquema? | Prisma — 32 migraciones aplicadas (`_prisma_migrations`), la última `20260907020000_examenes_finales`. |
| ¿Quién define RLS/funciones? | `supabase/sql/000…069` (70 archivos), aplicados fuera de banda con `npm run db:rls` (`scripts/apply-rls.ts`). `supabase_migrations.schema_migrations` solo tiene 2 filas — no es el registro real. |
| ¿Qué protege los datos? | RLS habilitado en **30/30** tablas de `public`. ~100 policies. Helpers `SECURITY DEFINER` en el schema `private` (no expuesto por PostgREST). |
| ¿Quién puede tocarlo? | `anon` y `authenticated` vía PostgREST con la clave pública; `service_role` server-side (`src/lib/supabase/admin.ts`) salta RLS. |
| Extensiones instaladas | `pgcrypto`, `unaccent`, `pg_trgm`, `uuid-ossp`, `pg_stat_statements`, `pg_cron`, `supabase_vault` — todas fuera de `public`. Correcto. |
| Tamaño real | La base entera ocupa < 3 MB. 9 perfiles, 8 cursos, 30 lecciones, 29 comentarios, 4 certificados, **0 pagos**. Datos de prueba, no de producción. |
| Trabajos programados | 2 jobs de `pg_cron`: limpieza de usuarios no verificados (03:00) y purga de tokens de vista previa (03:15). |

### Lo que está bien hecho (y merece decirse)

No es un esquema de aficionado. Antes de los hallazgos, lo que ya está resuelto:

- **Dinero en `bigint` de centavos**, nunca float, con `CHECK (>= 0)` y `CHECK (moneda ~ '^[A-Z]{3}$')` en `planes`, `planes_precios`, `pagos` y `suscripciones`.
- **Todas las marcas de tiempo son `timestamptz`** — sin una sola `timestamp` desnuda.
- **Cero claves foráneas sin índice.** Lo verifiqué contra `pg_constraint`/`pg_index`: 47 FK, 47 con índice de cobertura. Es el hallazgo número uno de casi toda auditoría de base de datos y aquí no existe.
- **`ON DELETE` elegido por relación, no copiado:** `CASCADE` en lo que es parte de su padre (lecciones→módulos, respuestas→examen), `RESTRICT` en lo contable e histórico (pagos, certificados, bitácora), `SET NULL` en los "quién lo hizo".
- **Auto-promoción a ADMINISTRADOR bloqueada en la base**, no solo en la app: `private.perfiles_bloquea_autopromocion()` cubre `rol` **y** `estado`, y exceptúa explícitamente `service_role`. Verificado.
- **Las tres RPC `SECURITY DEFINER` peligrosas comprueban el rol dentro del cuerpo** (`cerrar_suscripcion_caducada_admin`, `crear_lote_codigos_invitacion` verifican `es_administrador()`; `registrar_archivo_certificado` filtra por `id_usuario = auth.uid()`). El aviso del linter de Supabase sobre ellas es un falso positivo.
- **Todas las funciones `SECURITY DEFINER` fijan `search_path`.** Sin una sola vulnerable a secuestro de `search_path`.
- **Índices parciales únicos donde tocaba:** una sola suscripción ACTIVA/PAST_DUE por usuario, un solo intento de examen EN_CURSO por usuario y examen.
- **`eventos_webhook` con `UNIQUE (proveedor, id_evento_externo)`** — la idempotencia de webhooks está en la base, no en la app.

---

## 2. Cuadro de hallazgos

| # | Severidad | Hallazgo | Estado |
|---|---|---|---|
| D-1 | **P0** | RLS de `progreso` no exige acceso al curso → certificados auto-emitidos sin pagar | CONFIRMADO |
| D-2 | **P1** | El simulacro de restauración nunca se ejecutó; plan, retención, RPO y RTO desconocidos | CONFIRMADO |
| D-3 | **P1** | Helpers de RLS evaluados por fila: 1 613 buffers y 11,8 ms para leer 20 comentarios de una tabla de 29 filas | CONFIRMADO |
| D-4 | **P1** | El derecho de supresión es físicamente imposible: 8 de 9 usuarios no se pueden borrar | CONFIRMADO |
| D-5 | P2 | `comentarios_autor_publico` expone nombre, **rol** y país a `anon`, revelando quién es administrador | CONFIRMADO |
| D-6 | P2 | Faltan `CHECK`: descuento de cupón sin rango, `veces_usado` puede superar `limite_usos`, duraciones sin mínimo | CONFIRMADO |
| D-7 | P2 | La bitácora es append-only solo en RLS, y su escritura se traga los errores en silencio | CONFIRMADO |
| D-8 | P2 | `examenes`, `preguntas_examen` e `intentos_examen` sin trigger `set_actualizado_en` | CONFIRMADO |
| D-9 | P2 | Tablas de rate-limit con correos e IP sin purga programada | CONFIRMADO |
| D-10 | P2 | `progreso_cursos_estudiante` agrega `progreso` sin filtrar por usuario | CONFIRMADO |
| D-11 | P2 | Dos sistemas de migración en paralelo, sin orden compartido ni un solo `down.sql` | CONFIRMADO |
| D-12 | P3 | `eventos_webhook` y `mux_assets_pendientes_eliminacion` sin política de retención | CONFIRMADO |
| D-13 | P3 | Realtime sobre `codigos_invitacion`: 74 792 llamadas de decodificación de WAL con tráfico casi nulo | CONFIRMADO |
| D-14 | P3 | `curso_esta_completo` / `lecciones_completas_curso` ejecutables por `anon` | CONFIRMADO |
| D-15 | P3 | `instructores` con `USING (true)`: expone `id_perfil_profesor` a `anon` | CONFIRMADO |
| D-16 | P3 | `admin_listar_usuarios` no comprueba el rol (lo salva RLS, no el diseño) | CONFIRMADO |

---

## 3. Hallazgos P0

### D-1 — Un usuario registrado sin pagar puede auto-emitirse certificados verificables

**Severidad: P0 BLOCKER.** Es explotable hoy, con una sola llamada HTTP repetida,
y falsifica la credencial que es el producto vendible de la plataforma.

**Qué está mal**

La política de escritura de `progreso` no comprueba en ningún momento si el
usuario tiene acceso al curso:

```sql
-- supabase/sql/056_optimiza_auth_uid_rls.sql:109
create policy "progreso_insert_propio" on public.progreso
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
  );
```

Verifica *quién eres*, *que confirmaste el correo* y *que no estás suspendido*.
No verifica *que pagaste*. Y `private.emitir_certificado()`
(`supabase/sql/047_emision_automatica_certificados.sql`), disparada por el
trigger `progreso_emite_certificado`, tampoco comprueba acceso: solo llama a
`private.curso_esta_completo()`, que es "todas las lecciones completadas
(+ examen aprobado si el curso publica uno)".

**Evidencia**

Simulé al usuario `cbd430c1-…` — ESTUDIANTE, ACTIVO, correo verificado, sin
suscripción y sin cortesía — dentro de una transacción de solo lectura:

```
uid_simulado             | cbd430c1-d2bb-4aa0-a187-1b8805431de8
correo_ok                | true
cuenta_ok                | true
acceso_pago              | false   <- no tiene acceso a nada
pasa_with_check_progreso | true    <- pero la policy de escritura lo deja pasar
lecciones_visibles       | 16      <- y ve los ids de las 16 lecciones del catálogo
```

Y los cursos que puede completar sin que nada lo detenga:

| Curso | `mostrado` | Lecciones | ¿Exige examen? |
|---|---|---|---|
| Revit desde Cero para Arquitectos | sí | 7 | **no** |
| Lumion y Twinmotion | sí | 4 | **no** |
| Render Fotorrealista con V-Ray | sí | 3 | **no** |
| Presupuestos de diseños | sí | 2 | sí |

**Por qué importa concretamente**

Siete `POST /rest/v1/progreso` con `{"completado": true}` y el id de cada
lección — ids que el mismo usuario obtiene con un `GET /rest/v1/lecciones` — y
el trigger emite una fila en `certificados` con un `codigo_verificacion` real,
consultable públicamente por `verificar_certificado()`. El estudiante no vio un
solo segundo de video (eso sí lo protege Mux con `playback_policies: ["signed"]`,
verificado en la auditoría del 2026-09-03) pero se lleva el diploma. En una
plataforma educativa, el certificado *es* el producto.

Agrava el caso que las FK a `certificados` son `RESTRICT`: limpiar los
certificados falsos después no es un `DELETE` sencillo.

No es solo un problema de API directa. La propia Server Action delega la
autorización a RLS y lo dice en su comentario:

```ts
// src/actions/progreso/marcar.ts:14
// RLS: la política de `progreso` acota por `id_usuario = auth.uid()`, así que
// el upsert se hace con el cliente de sesión, nunca con service role.
```

La delegación es la decisión correcta. La policy es la que no cumple su parte.

**Por qué no lo detectó `npm run test:rls`**

Las 124 pruebas cubren *lectura* cruzada de `progreso` (líneas 313, 403, 508) y
cubren escritura de `inscripciones` desde un usuario sin acceso (líneas 430-434),
pero **no existe ni una prueba de escritura en `progreso` desde el cliente sin
acceso**. El único `upsert` de `progreso` en el script lo hace `clienteConAcceso`
(línea 743). El hueco de la prueba y el hueco de la policy son el mismo hueco.

**La corrección**

Añadir la condición de acceso al `WITH CHECK`, con el mismo helper que ya usa el
resto del esquema, y envuelto en subconsulta escalar por lo dicho en D-3:

```sql
-- supabase/sql/070_progreso_exige_acceso.sql
drop policy if exists "progreso_insert_propio" on public.progreso;
create policy "progreso_insert_propio" on public.progreso
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (select private.tiene_acceso_vigente_curso(
      (select m.id_curso from public.lecciones l
         join public.modulos m on m.id = l.id_modulo
        where l.id = id_leccion)
    ))
  );
-- Ídem para progreso_update_propio (mismo WITH CHECK).
```

Defensa en profundidad, porque una policy sola no debería ser lo único entre un
`curl` y un diploma — añadir la comprobación también dentro de
`private.emitir_certificado()`, antes de insertar:

```sql
if not private.tiene_acceso_vigente_curso_de(p_id_usuario, p_id_curso) then
  return;
end if;
```

(requiere una variante de `tiene_acceso_vigente_curso` que reciba el usuario en
vez de leer `auth.uid()`, porque el trigger corre como `DEFINER`).

**Nota sobre la lección introductoria:** hoy `es_leccion_introductoria` abre la
primera lección de cada curso a cualquiera. Si eso debe seguir siendo así, la
condición correcta es `tiene_acceso_vigente_curso(...) OR es_leccion_introductoria(id_leccion)`
— un usuario sin pagar podrá marcar la lección gratuita, pero nunca las 7 que
hacen falta para el certificado.

**Cómo verificar la corrección**

1. Añadir a `scripts/rls-test.ts`, junto a las pruebas de `inscripciones` de la
   línea 430:
   ```
   "estudiante sin acceso NO puede insertar progreso en un curso del catálogo"
   "estudiante sin acceso NO puede marcar completada una lección que no sea la introductoria"
   "completar todas las lecciones sin acceso NO emite certificado"
   ```
2. `npm run test:rls` debe pasar 127/127.
3. Contra la base, repetir la simulación de arriba: `pasa_with_check_progreso`
   debe dar `false` para una lección no introductoria.

---

## 4. Hallazgos P1

### D-2 — El simulacro de restauración nunca se ejecutó

**Qué está mal.** `docs/ops/respaldos-y-restauracion.md` es un procedimiento bien
escrito — describe crear un proyecto de simulacro, restaurar, correr
`prisma:deploy` + `db:rls` + `test:rls` y cronometrar. Pero está sin ejecutar.
Sus campos siguen en blanco:

```
docs/ops/respaldos-y-restauracion.md:18  - **Plan:** _______ (Free / Pro / Team / Enterprise)
docs/ops/respaldos-y-restauracion.md:19  - **Tipo de respaldo:** _______
docs/ops/respaldos-y-restauracion.md:21  - **Retención real:** _______ días
docs/ops/respaldos-y-restauracion.md:23  - **Hora del último respaldo exitoso:** _______
docs/ops/respaldos-y-restauracion.md:85  | Fecha del simulacro | |
docs/ops/respaldos-y-restauracion.md:87  | Antigüedad del respaldo restaurado (RPO) | |
docs/ops/respaldos-y-restauracion.md:88  | Tiempo total de restauración (RTO) | |
```

**Por qué importa.** El propio documento lo dice mejor de lo que lo diría yo: si
el proyecto está en plan Free, Supabase no hace respaldos automáticos, y eso
sería "el hallazgo más urgente de todo este documento". Hoy nadie sabe en qué
plan está el proyecto. Mientras la respuesta sea desconocida, la capacidad de
recuperación de este sistema es **desconocida**, no "probablemente bien".

El riesgo real no es solo perder datos. Es el escenario que el propio documento
identifica: restaurar y que las ~100 policies vuelvan en un estado distinto al
versionado. Restaurar y quedar abierto.

**La corrección.** Ejecutar el procedimiento tal como está escrito. No hay que
diseñar nada.

**Cómo verificar.** Las tres celdas de la tabla de la línea 85-88 con números
reales, y un commit con esa fecha.

**No lo pude verificar yo:** el MCP de Supabase no expone la configuración de
respaldos del proyecto; requiere el panel con permisos de owner.

---

### D-3 — Los helpers de RLS se evalúan una vez por fila

**Qué está mal.** `private.es_administrador()`, `private.tiene_acceso_vigente_curso()`
y sobre todo `private.es_leccion_introductoria()` aparecen desnudos en las
policies. Son `STABLE`, pero Postgres **no** las promueve a InitPlan por sí solo:
las evalúa por fila, dentro del `Filter` del scan.

La migración `056_optimiza_auth_uid_rls.sql` ya aplicó el truco correcto —
envolver en `(select …)` — pero solo a `auth.uid()`. Los helpers quedaron fuera.
El linter de Supabase tampoco lo ve: solo reconoce `auth.<fn>()` y
`current_setting()` literales, así que reporta **1** caso
(`comentario_moderacion`) y se le escapan las ~40 policies restantes.

**Evidencia medida.** Leer 20 comentarios, como un estudiante con suscripción
activa, en una base con **29 comentarios, 30 lecciones, 14 módulos y 8 cursos**:

```
Limit  (actual time=11.387..11.391 rows=20 loops=1)
  Buffers: shared hit=1613
  ->  Seq Scan on comentarios c  (actual time=2.130..11.340 rows=29 loops=1)
        Filter: (private.es_administrador()
                 OR private.es_leccion_introductoria(id_leccion)
                 OR (ANY (id_leccion = (hashed SubPlan 18).col1)))
        Buffers: shared hit=1610
Execution Time: 11.802 ms
```

**1 613 buffers para devolver 29 filas: 55 páginas por comentario.**

Y el predicado de `cursos` aparece **duplicado literalmente** en el plan, dos
evaluaciones completas por fila:

```
Filter: ((mostrado OR private.es_administrador() OR private.tiene_acceso_vigente_curso(id))
     AND (mostrado OR private.es_administrador() OR private.tiene_acceso_vigente_curso(id)))
```

Aislando el peor de los tres helpers:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM public.comentarios c
 WHERE private.es_leccion_introductoria(c.id_leccion);

Seq Scan on comentarios c (actual time=2.236..3.496 rows=21 loops=1)
  Filter: private.es_leccion_introductoria(id_leccion)
  Buffers: shared hit=605          <- 21 buffers por comentario
Execution Time: 3.649 ms
```

**Por qué importa.** `es_leccion_introductoria()` no es cacheable: depende de la
fila. Cada llamada hace un CTE que une `lecciones` con `modulos` para *todo* el
curso, ordena por `(modulo.orden, leccion.orden)` y toma el primero. El coste
crece con **lecciones por curso × comentarios mostrados**. Hoy, con 30 lecciones
en total, ya cuesta 11,8 ms y 12,6 MB de tráfico de buffers por una lista de 20
comentarios. Con un curso de 60 lecciones y 5 000 comentarios, esa misma pantalla
—que es la pantalla del reproductor, la más visitada de la aplicación— hace 5 000
escaneos ordenados del temario.

**La corrección.** Dos cambios, en este orden:

1. **Materializar la lección introductoria.** Es un dato que cambia cuando se
   reordena el temario, no cuando alguien lee un comentario:
   ```sql
   alter table public.lecciones add column es_introductoria boolean not null default false;
   create index on public.lecciones (id_modulo) where es_introductoria;
   -- mantenida por trigger sobre lecciones/modulos, y por
   -- reespaciar_orden_lecciones / reespaciar_orden_modulos, que ya existen.
   ```
   La policy pasa de una llamada a función por fila a una referencia a columna.

2. **Envolver los helpers restantes en subconsulta escalar**, extendiendo el
   patrón de `056` a `es_administrador()` y `tiene_acceso_vigente_curso()`:
   ```sql
   -- de:  private.es_administrador()
   -- a:   (select private.es_administrador())
   ```
   Con esto pasan a InitPlan: una evaluación por consulta en vez de una por fila.

**Cómo verificar.** Repetir el `EXPLAIN (ANALYZE, BUFFERS)` de arriba. Objetivo:
`shared hit` por debajo de 100 y ninguna llamada a `es_administrador` /
`tiene_acceso_vigente_curso` dentro de un `Filter` por fila (deben aparecer como
`InitPlan`). `npm run test:rls` debe seguir en 124/124 — el cambio no altera la
semántica.

---

### D-4 — El derecho de supresión es físicamente imposible en el esquema

**Qué está mal.** `perfiles.id` referencia `auth.users` con `ON DELETE CASCADE`,
pero **diez** tablas referencian `perfiles` con `ON DELETE RESTRICT`:
`progreso`, `certificados`, `suscripciones`, `comentarios`, `comentario_likes`,
`comentario_moderacion`, `inscripciones`, `intentos_examen`, `curso_instructores`,
`bitacora_administrativa`.

El resultado es que borrar un usuario de Supabase Auth dispara la cascada a
`perfiles`, que choca contra el primer `RESTRICT` y aborta la transacción entera
con un error de clave foránea.

**Evidencia.** Filas dependientes por usuario, hoy:

| Usuario | progreso | certif. | susc. | coment. | inscr. | bitácora | intentos | ¿borrable? |
|---|---|---|---|---|---|---|---|---|
| `ec9c6ccf…` | 11 | 3 | 2 | 20 | 1 | 0 | 2 | **no** |
| `7fecdbd5…` | 7 | 1 | 3 | 0 | 0 | 0 | 1 | **no** |
| `e31215e0…` (admin) | 6 | 0 | 3 | 6 | 0 | 53 | 0 | **no** |
| `5fe0a11e…` (profesor) | 3 | 0 | 1 | 3 | 0 | 0 | 0 | **no** |
| `527c0a10…` | 3 | 0 | 1 | 0 | 1 | 0 | 0 | **no** |
| `0d3b2ee0…` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **no** |
| `cbd430c1…` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **no** |
| `7332b894…` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **no** |
| `76f3d855…` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | sí |

**8 de 9.** Basta una fila en `suscripciones` — que `handle_new_user` no crea,
pero que aparece en cuanto el usuario canjea un código — para volver la cuenta
indeleble.

**Por qué importa.** No es solo una limitación técnica: es una promesa
incumplible. El borrador de política de privacidad ya compromete el derecho:

```
docs/legal/contenido-soporte.md:364  5. Revocar la autorización y/o solicitar la supresión de tus datos, cuando
docs/legal/contenido-soporte.md:390  constancia académica, salvo que solicites su supresión y no exista
```

La Ley 1581 de 2012 (Habeas Data) da al titular el derecho de supresión, y la
plataforma lo anuncia. Hoy no existe ni una ruta de código que lo intente:
`grep` de `deleteUser`, `eliminarCuenta`, `anonimiz` sobre `src/actions`,
`src/app` y `src/lib` no devuelve nada.

**La corrección.** La supresión de un estudiante no puede ser un `DELETE` —
`pagos` y `certificados` tienen valor contable y probatorio legítimo. El diseño
correcto es **anonimización**, decidida por tabla:

| Tabla | Acción en supresión |
|---|---|
| `perfiles` | `nombre`→`'Usuario eliminado'`, `correo`→`'anon+<hash>@uva.invalid'`, `celular`, `especialidad`, `pais` → NULL; marcar `estado`/columna nueva `anonimizado_en` |
| `comentarios` | conservar la fila, vaciar `contenido` (ya lo permite el trigger `comentarios_contenido_solo_se_vacia`), marcar `eliminado` |
| `progreso`, `intentos_examen` | borrar — no tienen valor probatorio |
| `certificados` | conservar: `nombre_estudiante` ya es un *snapshot* congelado, exactamente el dato que un certificado debe conservar para ser verificable |
| `suscripciones`, `pagos` | conservar por obligación contable; ya no contienen datos personales directos |
| `bitacora_administrativa` | conservar: es el registro de auditoría, y `RESTRICT` ahí es correcto |
| `auth.users` | `supabase.auth.admin.deleteUser()` al final, cuando ya no queda nada que lo referencie salvo lo conservado |

Implementarlo como una única función `SECURITY DEFINER` transaccional
(`private.anonimizar_usuario(uuid)`), invocada por una Server Action de admin y
registrada en la bitácora.

**Cómo verificar.** Una prueba en `scripts/rls-test.ts` que cree un usuario
desechable, le genere progreso, un comentario y un certificado, llame a la
anonimización y compruebe: cero PII en `perfiles`, el certificado sigue
verificable con `verificar_certificado()`, el comentario existe con contenido
vacío, y `auth.users` ya no tiene la fila.

---

## 5. Hallazgos P2

### D-5 — `comentarios_autor_publico` revela a `anon` quién es administrador

`comentarios_autor_publico` es una vista `SECURITY DEFINER` (tiene
`security_barrier=true` pero **no** `security_invoker=true`), así que corre como
su dueño y salta la RLS de `perfiles`. Está concedida a `anon`.

Verificado como `anon`:

```
vista                     | filas | roles_expuestos                        | nombres
comentarios_autor_publico |   3   | ADMINISTRADOR,ESTUDIANTE,PROFESOR      | Ana Ruiz (Admin) | Camilo Restrepo | Shekaru
```

Exponer `nombre` y `pais` junto a un comentario público es la intención de la
vista y es razonable. Exponer **`rol`** no: le entrega a cualquier visitante sin
sesión la lista de qué cuentas son administradoras — el primer paso de un ataque
dirigido de phishing o de *credential stuffing*. La UI necesita distinguir al
profesor verificado, no necesita decir quién es admin.

**Fix:** sustituir `rol` por un booleano derivado:
```sql
create or replace view public.comentarios_autor_publico
with (security_barrier = true) as
select distinct id, nombre, pais, (rol = 'PROFESOR') as es_profesor
from perfiles p where ( … igual … );
```
**Verificar:** como `anon`, `select * from comentarios_autor_publico` no debe
contener ninguna columna con el valor `ADMINISTRADOR`.

---

### D-6 — Restricciones `CHECK` que faltan

El esquema es riguroso con el dinero de `planes`/`pagos`/`suscripciones` y se
olvidó de la tabla que aplica descuentos:

| Tabla.columna | Falta | Qué permite hoy |
|---|---|---|
| `cupones.valor` | `CHECK (valor >= 0)` y, para `tipo_descuento='PORCENTAJE'`, `valor <= 100` | Un cupón de 500 % de descuento, o negativo |
| `cupones.limite_usos` | `CHECK (limite_usos IS NULL OR limite_usos >= 1)` | Cupón con límite 0 o negativo |
| `cupones` / `codigos_invitacion` | `CHECK (veces_usado <= limite_usos)` | El contador puede superar el límite (`codigos_invitacion` sí tiene `limite_usos >= 1`, pero nada acota `veces_usado`) |
| `codigos_invitacion.duracion_dias`, `lotes.duracion_dias`, `lotes.cantidad`, `planes.duracion_dias` | `CHECK (>= 1)` | Un código que otorga 0 o −30 días de acceso |
| `suscripciones` | `CHECK (fecha_renovacion IS NULL OR fecha_renovacion > fecha_inicio)` | Renovación anterior al inicio |
| `intentos_examen` | `CHECK (expira_en IS NULL OR expira_en > iniciado_en)` | Intento nacido expirado |
| `progreso.segundo_actual`, `lecciones.duracion` | `CHECK (>= 0)` | Segundos negativos |

`cupones` está en 0 filas: es el momento exacto y más barato para añadirlas, sin
backfill ni validación de datos existentes.

**Verificar:** por cada `CHECK` nuevo, un `INSERT` que debe fallar en
`scripts/rls-test.ts` o en una prueba de Vitest.

---

### D-7 — La bitácora es inmutable solo frente a quien no la escribe

`069_bitacora_append_only.sql` borra las policies de UPDATE y DELETE y deja solo
la de INSERT. Eso hace `bitacora_administrativa` append-only para `anon` y
`authenticated` — pero **`service_role` salta RLS por completo**, y es el cliente
que la aplicación usa para las operaciones administrativas. La garantía no cubre
al único actor con capacidad de alterarla.

Además, `registrarBitacora` se traga el error:

```ts
// src/lib/admin/bitacora.ts:20
await supabase.from("bitacora_administrativa").insert({ … });
// sin comprobar { error }
```

El comentario dice que un fallo aquí no debe tumbar la acción ya realizada — de
acuerdo — pero hoy tampoco deja rastro de que falló. Una acción administrativa
puede completarse sin entrada de auditoría y nadie se entera.

**Fix:**
```sql
create function private.bitacora_es_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'bitacora_administrativa es append-only'
    using errcode = '42501';
end $$;

create trigger bitacora_append_only
  before update or delete on public.bitacora_administrativa
  for each row execute function private.bitacora_es_inmutable();
```
Un trigger sí se dispara para `service_role`. Y en `bitacora.ts`, capturar el
error y emitirlo con `logError("bitacora", …)`.

**Verificar:** con el cliente de `service_role`, un `UPDATE` y un `DELETE` sobre
la bitácora deben fallar con 42501.

---

### D-8 — Tres tablas sin trigger `set_actualizado_en`

`examenes`, `preguntas_examen` e `intentos_examen` tienen columna
`actualizado_en timestamptz NOT NULL DEFAULT now()`, pero no aparecen en
`pg_trigger`. Las otras 22 tablas con esa columna sí lo tienen. La migración
`067_examenes.sql` no lo incluyó (`grep set_actualizado_en supabase/sql/067_examenes.sql`
no devuelve nada).

Consecuencia: en esas tres tablas `actualizado_en` congela la fecha de creación.
Cualquier lógica futura de "modificado desde", sincronización incremental o
depuración por fecha dará un resultado incorrecto y silencioso.

**Fix:** tres `CREATE TRIGGER … EXECUTE FUNCTION private.actualiza_actualizado_en()`.
**Verificar:** `UPDATE` sobre un examen y comprobar que `actualizado_en > creado_en`.

---

### D-9 — Tablas de rate-limit con correos e IP sin purga programada

El schema `private` guarda seis tablas de control de abuso —
`intentos_login` (clave: correo), `intentos_check_email` (clave: IP),
`intentos_verificar_certificado` (IP), `recuperacion_reenvios` (correo),
`verificacion_reenvios` (correo), `intentos_canjear_codigo` (id de usuario).
Todas contienen datos personales bajo la Ley 1581.

Existe `public.limpiar_intentos_rate_limit()` y el comando
`npm run rate-limit:limpiar`. Pero `cron.job` tiene exactamente dos entradas y
ninguna es esa:

```
283 | 0 3 * * *  | select private.limpiar_usuarios_no_verificados();
284 | 15 3 * * * | select private.purgar_tokens_vista_previa();
```

Es decir: la limpieza depende de que alguien la ejecute a mano.

**Fix:** un tercer job de `pg_cron` — la infraestructura ya está instalada y
probada con los otros dos:
```sql
select cron.schedule('limpiar-rate-limit', '30 3 * * *',
  $$select public.limpiar_intentos_rate_limit()$$);
```
**Verificar:** `select * from cron.job` muestra tres filas activas; al día
siguiente, `cron.job_run_details` registra la ejecución.

---

### D-10 — `progreso_cursos_estudiante` agrega progreso ajeno

La vista es `security_invoker=true` (correcto), pero su lateral no filtra por
usuario:

```sql
LEFT JOIN LATERAL (
  SELECT bool_or(pr_1.completado) AS completado, max(pr_1.actualizado_en)
  FROM progreso pr_1
  WHERE pr_1.id_leccion = l.id        -- <- sin AND pr_1.id_usuario = auth.uid()
) pr ON true
```

Para un estudiante el resultado es correcto **por accidente**: la policy
`progreso_select_propio` recorta las filas antes. Pero esa misma policy dice
`OR private.es_administrador()`, así que **para un administrador la vista
devuelve `bool_or` sobre el progreso de todos los usuarios**: "lecciones
completadas" pasa a significar "lecciones que completó alguien".

Una vista cuya corrección depende íntegramente de que RLS la recorte es frágil:
sobrevive hasta el día que alguien la consulte con `service_role` o le añada una
policy de admin a `progreso` (que ya existe).

**Fix:** añadir `and pr_1.id_usuario = (select auth.uid())` al lateral y a la CTE
`cursos_tocados`. Hacer explícito lo que el nombre ya promete.
**Verificar:** consultar la vista como administrador y comprobar que
`lecciones_completadas` coincide con el progreso propio del admin, no con el
agregado.

---

### D-11 — Dos sistemas de migración sin orden compartido, y ningún `down.sql`

El esquema lo mueve Prisma (32 migraciones en `_prisma_migrations`). RLS,
funciones, triggers, vistas y permisos los mueven 70 archivos de `supabase/sql/`
aplicados por `scripts/apply-rls.ts`. `supabase_migrations.schema_migrations`
—el registro que Supabase considera canónico— tiene **2 filas**, ninguna
representativa.

Los dos flujos son idempotentes por separado, pero **no comparten orden**. Un
archivo de `supabase/sql/` que asume una columna creada por una migración de
Prisma no tiene forma de declarar esa dependencia; el orden correcto solo existe
en la cabeza de quien despliega y en comentarios sueltos ("Orden de aplicación:
DESPUÉS de 000-017", `019_cuenta_activa_rls.sql:5`).

Y `find prisma/migrations -name down.sql` devuelve **0**. Ninguna migración es
reversible. Existe `npm run verificar:migraciones-reversibles`, que comprueba
otra cosa.

Es una decisión defendible mientras no haya producción, y el `README` de
`prisma/` la documenta. Pero es exactamente la clase de deuda que se cobra el
día del primer despliegue fallido con usuarios reales.

**Fix mínimo, por orden de coste:**
1. `apply-rls.ts` debe registrar cada archivo aplicado en una tabla propia
   (`private.rls_aplicados`), no solo ejecutarlos. Sin eso no hay forma de
   auditar el estado real de un proyecto restaurado.
2. Declarar en la cabecera de cada archivo `supabase/sql/` la migración Prisma
   mínima que requiere, y que `apply-rls.ts` lo verifique contra
   `_prisma_migrations` antes de ejecutar.
3. `down.sql` al menos para las migraciones que añaden columnas o tablas — las
   baratas de revertir. Documentar por qué las otras no lo tienen.

**Verificar:** `db:rls:check` contra un proyecto vacío debe fallar con un
mensaje claro de dependencia, en vez de con un error de columna inexistente.

---

## 6. Hallazgos P3

- **D-12 — Sin retención en `eventos_webhook` ni en `mux_assets_pendientes_eliminacion`.**
  La primera guarda cargas útiles de Stripe/Wompi/Mux (que pueden traer datos de
  pago) y crece sin límite; la segunda tiene `eliminado_en` y nunca se purga.
  Añadir ambas al job de limpieza con una ventana explícita (90 días para
  webhooks procesados, 30 para assets ya eliminados).

- **D-13 — Realtime sobre `codigos_invitacion` es el mayor coste atribuible a la aplicación.**
  `pg_stat_statements` sitúa el decodificador de WAL de Realtime en **74 792
  llamadas / 357 s acumulados**, con ~0 usuarios reales. La publicación
  `supabase_realtime` incluye `public.codigos_invitacion` con INSERT/UPDATE/DELETE.
  La RLS sí se aplica (solo un admin suscrito recibe los cambios), así que no es
  un problema de seguridad — pero crear un lote de 500 códigos genera 500 eventos
  de WAL con evaluación de RLS por evento y por suscriptor. Si la pantalla de
  códigos no necesita actualización en vivo al segundo, quitarla de la
  publicación y recargar bajo demanda cuesta menos.

- **D-14 — `curso_esta_completo()` y `lecciones_completas_curso()` ejecutables por `anon`.**
  Ambas son `SECURITY DEFINER` y leen `auth.uid()` internamente, así que para
  `anon` devuelven `null` — inocuo. Aun así, `revoke execute … from anon` cierra
  el aviso del linter y respeta el principio de menor privilegio.

- **D-15 — `instructores` con `USING (true)`.**
  Expone las 14 filas a `anon`, incluido `id_perfil_profesor` (el UUID de una
  cuenta real). Basta acotar a instructores asignados a un curso `mostrado`, o
  crear una vista pública sin esa columna, igual que se hizo con
  `curso_instructores_publico`.

- **D-16 — `admin_listar_usuarios` no comprueba el rol.**
  Es `SECURITY INVOKER` y está concedida a `anon` y `authenticated`. No filtra
  nada: la RLS de `perfiles` recorta el resultado a la fila propia (verificado:
  un estudiante ve 1 perfil, `anon` ve 0). No hay fuga. Pero una función llamada
  `admin_*` que cualquiera puede invocar es una trampa para el próximo cambio:
  el día que alguien le añada una policy de lectura más amplia a `perfiles`, se
  convierte en un volcado de usuarios. Añadir el `if not private.es_administrador() then raise`
  cuesta tres líneas.

- **20 índices "sin uso" reportados por el linter.** No accionable: con 9
  perfiles y 8 cursos, Postgres prefiere el escaneo secuencial y nunca tocaría
  esos índices aunque fueran perfectos. La estadística no significa nada hasta
  que haya volumen. **No los borre por este aviso.**

---

## 7. Lo que no pude verificar

Sección obligatoria. Nada de esto está implícitamente bien.

1. **Plan de respaldos, retención, PITR, RPO y RTO reales.** El MCP de Supabase
   no expone la configuración de respaldos. Requiere el panel con permisos de
   owner (D-2).
2. **Si el simulacro de restauración funciona.** No solo no se ha hecho: no
   puedo hacerlo yo, porque crear el proyecto de simulacro y restaurar sobre él
   son operaciones de escritura, prohibidas en esta auditoría.
3. **El coste real de las consultas bajo carga.** `pg_stat_statements` está
   dominado por la introspección de Supabase Studio y de mis propias
   herramientas de auditoría — las tres consultas más caras son `list_extensions`,
   el decodificador de WAL y `pg_timezone_names`. Ninguna consulta de la
   aplicación aparece en el top 15. Con 9 usuarios y < 3 MB, **los planes que
   medí en D-3 son cualitativamente correctos pero sus tiempos absolutos no
   predicen producción**. La conclusión de D-3 se sostiene en la *forma* del plan
   (llamadas a función por fila), no en los 11,8 ms.
4. **Configuración del pool de conexiones** (PgBouncer / Supavisor, tamaño,
   modo transacción o sesión) frente al número de workers de Railway. No es
   consultable desde el catálogo.
5. **Si la explotación de D-1 ocurre de punta a punta.** Confirmé que el
   predicado `WITH CHECK` se evalúa a `true` para un usuario sin acceso y que
   ese usuario ve los ids de las lecciones. **No ejecuté el `INSERT`** — habría
   sido una escritura, y disparado el trigger de certificados. La cadena está
   probada hasta el último paso verificable sin escribir.
6. **El proyecto de staging** (`tmvmthdwapegypveaosd`). Solo audité el proyecto
   configurado en el MCP. Los hallazgos deberían replicarse allí, pero no lo
   comprobé.
7. **Si existe algún proyecto de producción separado.** Según
   `docs/audit/rls-content-leak-2026-09.md` (F-1), no lo hay todavía. No lo
   pude confirmar de forma independiente.
8. **Contenido de `lecciones.contenido` y `preguntas_examen.respuestas_aceptadas`
   frente a lo que ve un no pagador.** Confirmé que `anon` ve 16 lecciones con 1
   `contenido` no nulo; no evalué si ese contenido es material de pago. Los
   videos sí están protegidos (Mux `signed`, verificado el 2026-09-03). **Merece
   una revisión aparte**: si `contenido` va a alojar el material escrito del
   curso, la policy `lecciones_select_curso_publico` (que solo exige
   `cursos.mostrado`) lo publica entero.

---

## 8. Calificación del dominio de datos

Contra lo que este proyecto dice ser — un MVP pre-lanzamiento, sin pagos
conectados, sin usuarios reales — no contra un ideal.

| Área | Nota | Justificación |
|---|---|---|
| Diseño de esquema | 88 | Tipos, dinero, `timestamptz`, `ON DELETE` deliberado. Faltan `CHECK` en cupones (D-6). |
| Índices | 92 | Cero FK sin índice. Los "sin uso" no son señal a este volumen. |
| Integridad y restricciones | 72 | Índices únicos parciales excelentes; `CHECK` incompletos. |
| Autorización en la base (RLS) | 55 | 30/30 con RLS y helpers bien diseñados, pero **D-1 es una omisión explotable en la ruta de escritura más usada**. |
| Rendimiento de consulta | 60 | Forma de plan medida y mala (D-3); sin impacto todavía por volumen. |
| Migraciones | 55 | Versionadas y en el repositorio, pero dos sistemas sin orden común y cero reversibles. |
| Supervivencia (respaldos) | 30 | Procedimiento escrito y bueno. Sin ejecutar. Plan desconocido. |
| Ciclo de vida del dato | 35 | Sin ruta de supresión, sin retención en cuatro tablas con datos personales. |
| Auditoría e inmutabilidad | 60 | Bitácora bien modelada; garantía de inmutabilidad no cubre a `service_role`. |

**Global del dominio de datos: 61 / 100.**

La distancia entre 61 y una nota buena no está en el esquema —que está por
encima de la media— sino en tres cosas concretas: una policy de escritura a la
que le falta una condición (D-1), un procedimiento de recuperación escrito y no
ejecutado (D-2), y un derecho legal prometido sin ruta técnica (D-4).

---

## 9. Orden de trabajo sugerido

1. **D-1** — cerrar la policy de `progreso` + las tres pruebas nuevas en
   `rls-test.ts`. Es lo único que bloquea un lanzamiento.
2. **D-2** — ejecutar el simulacro de restauración y llenar la tabla. Antes de
   cargar contenido real.
3. **D-6, D-8, D-9** — una sola migración `070_…`: los `CHECK` faltantes, los
   tres triggers y el job de `pg_cron`. Media hora, riesgo nulo (`cupones` está
   vacía).
4. **D-5, D-7, D-16** — endurecimientos pequeños de exposición.
5. **D-4** — diseñar e implementar `private.anonimizar_usuario()`. Es el más
   grande de los cuatro P0/P1 y el único que no urge hasta que haya usuarios
   reales, pero condiciona la política de privacidad que ya está redactada.
6. **D-3** — materializar `es_introductoria` y envolver los helpers. Hacerlo
   antes de que el catálogo crezca, no cuando la pantalla del reproductor ya
   vaya lenta.
7. **D-10, D-11, D-12, D-13, D-15** — deuda programada.
