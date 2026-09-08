# Plan de remediación — capa de datos

**Origen:** `AUDIT-2026-09-08-base-de-datos.md` (16 hallazgos: 1 P0, 3 P1, 7 P2, 5 P3).
**Criterio de recorte pedido:** todo lo que dependa de contratar Supabase Pro se
posterga. Ver §1 — son **dos** cosas, y ninguna bloquea los otros catorce hallazgos.
**Regla que no cambia:** ningún arreglo se da por cerrado sin una prueba que
falle antes y pase después.

---

## 0. Restricciones del repositorio que condicionan el plan

Verificadas en `scripts/apply-rls.ts` antes de escribir esto. No son opinión:

1. **Todos los archivos de `supabase/sql/` se aplican dentro de una sola
   transacción** (`apply-rls.ts:30-40`). Por tanto **ninguna sentencia no
   transaccionable**: nada de `CREATE INDEX CONCURRENTLY`, `VACUUM` ni
   `REINDEX` en esos archivos. Con el volumen actual (< 3 MB) un `CREATE INDEX`
   normal es instantáneo; cuando las tablas crezcan, un índice nuevo tendrá que
   salir de este pipeline (ver Lote 4, nota de despliegue).
2. **El nombre debe ser `NNN_descripcion.sql`** con prefijo de tres dígitos:
   `apply-rls.ts` ordena por ese número y aborta si falta. El último es `069`,
   así que este plan usa **070 en adelante**.
3. **Todo script debe ser idempotente** — `drop policy if exists` antes de
   `create policy`, `create or replace function`, `drop constraint if exists`
   antes de `add constraint` (patrón de `042_restricciones_dinero_y_proveedor.sql:59-62`),
   `cron.unschedule` antes de `cron.schedule`. `npm run db:rls:check` aplica y
   hace ROLLBACK: es la verificación de que la idempotencia es real y no supuesta.
4. **Las columnas nuevas van por Prisma**, no por `supabase/sql/`. Hay un
   precedente al revés (`060_perfil_pais.sql:14` crea `perfiles.pais` con
   `add column if not exists`, y esa columna está en `schema.prisma:142` pero
   **en ninguna migración de Prisma**). Ese precedente es justamente el drift
   que describe D-11 y no conviene ampliarlo.

---

## 1. Lo que se posterga por depender del plan Pro

| Tema | Hallazgo | Por qué necesita Pro |
|---|---|---|
| Respaldos automáticos diarios y PITR | **D-2 (P1)** | El plan Free de Supabase no hace respaldos automáticos. El respaldo diario es de Pro; el PITR es un complemento de pago sobre Pro. |
| Protección de contraseñas filtradas (HaveIBeenPwned) | aviso del linter | Es un interruptor de Auth disponible en Pro. **Ya estaba decidido así**: commit `887ec09`, "Revierte el chequeo de contrasenas filtradas: se hara con el toggle de Supabase en Pro". |

Ningún otro hallazgo depende del plan. `pg_cron` funciona en Free — de hecho ya
corre dos trabajos en este proyecto, así que el Lote 1 no tiene ningún bloqueo.

### 1.1 Medida interina para D-2, gratis, mientras no haya Pro

Postergar D-2 significa hoy **no tener ninguna capacidad de recuperación**, ni
probada ni sin probar. Eso es aceptable mientras la base solo tenga datos de
prueba —lo es hoy— y deja de serlo el día que entre el primer contenido real o
el primer usuario pagando. Para no llegar a ese día sin nada, hay una versión
gratuita del simulacro que **no reemplaza a D-2** pero sí responde la pregunta
que D-2 deja abierta:

1. `pg_dump` lógico del proyecto contra un archivo local o un bucket, desde
   GitHub Actions con `DATABASE_URL` en secretos. Un `cron` semanal basta a este
   volumen.
2. Restaurar ese dump sobre el proyecto de staging que ya existe
   (`tmvmthdwapegypveaosd`, creado el 2026-09-03) — no hay que crear nada nuevo.
3. Correr contra el restaurado, en este orden, igual que dice
   `docs/ops/respaldos-y-restauracion.md`: `prisma:deploy` → `db:rls` → `test:rls`.
4. **Cronometrar y llenar la tabla de las líneas 85-88 de ese documento.**

Eso da un RTO y un RPO reales y medidos, aunque el RPO sea malo (una semana).
Un número malo y conocido se puede decidir; un número desconocido, no.

**Decisión que corresponde al dueño del proyecto, no a mí:** si esta medida
interina se implementa ahora o si D-2 simplemente espera a contratar Pro. El
plan de abajo no depende de la respuesta.

---

## 2. Lotes de trabajo

Ordenados por lo que desbloquean, no por dificultad. Los lotes 0 a 2 son de bajo
riesgo y se pueden hacer en un día.

---

### Lote 0 — Cerrar D-1 (P0). Bloquea el lanzamiento

**Cierra:** D-1, certificados auto-emitidos por un usuario sin pagar.

#### 0.1 `supabase/sql/070_progreso_exige_acceso.sql`

Añade la condición de acceso al `WITH CHECK` de las dos policies de escritura de
`progreso`, conservando la excepción de la lección introductoria (sin ella, el
flujo gratuito del catálogo deja de funcionar: `iniciarProgresoLeccion` inserta
una fila en cuanto alguien abre una clase).

```sql
-- 070_progreso_exige_acceso.sql
-- Cierra AUDIT-2026-09-08 D-1 (P0).
--
-- Las policies de 019/056 verificaban quién eres, que confirmaste el correo y
-- que no estás suspendido — nunca que tuvieras acceso al curso. Un registrado
-- verificado sin suscripción podía marcar completadas las 7 lecciones de un
-- curso del catálogo y el trigger 047 le emitía un certificado verificable.
--
-- La excepción de lección introductoria es deliberada: es la clase gratuita del
-- catálogo, y `iniciarProgresoLeccion` (src/actions/progreso/marcar.ts) escribe
-- una fila al abrirla. Sin la excepción, el visitante no puede ni empezar.
-- Un curso necesita >1 lección para tener introductoria
-- (private.es_leccion_introductoria), así que la excepción nunca alcanza para
-- completar un curso entero.
--
-- El helper va envuelto en (select …) por AUDIT-2026-09-08 D-3: así se evalúa
-- como InitPlan y no una vez por fila.

drop policy if exists "progreso_insert_propio" on public.progreso;
create policy "progreso_insert_propio" on public.progreso
  for insert with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (
      (select private.tiene_acceso_vigente_curso(
        (select m.id_curso
           from public.lecciones l
           join public.modulos m on m.id = l.id_modulo
          where l.id = id_leccion)))
      or private.es_leccion_introductoria(id_leccion)
    )
  );

drop policy if exists "progreso_update_propio" on public.progreso;
create policy "progreso_update_propio" on public.progreso
  for update
  using ((select auth.uid()) = id_usuario)
  with check (
    (select auth.uid()) = id_usuario
    and private.correo_verificado()
    and private.cuenta_activa()
    and (
      (select private.tiene_acceso_vigente_curso(
        (select m.id_curso
           from public.lecciones l
           join public.modulos m on m.id = l.id_modulo
          where l.id = id_leccion)))
      or private.es_leccion_introductoria(id_leccion)
    )
  );
```

**Verificado antes de escribirlo.** Evalué el predicado como cada usuario, en
transacciones de solo lectura:

| | lección introductoria | lección de pago |
|---|---|---|
| Estudiante **sin** acceso (`cbd430c1…`) | ✅ permite | ❌ **bloquea** ← cierra D-1 |
| Estudiante **con** acceso (`0d3b2ee0…`) | ✅ permite | ✅ permite |

#### 0.2 Segunda capa: guardia dentro de `emitir_certificado`

Una policy sola no debería ser lo único entre un `curl` y un diploma. Pero la
guardia **no puede usar `auth.uid()`**, y ese detalle es la parte fácil de
equivocar:

- `auth.uid()` lee el GUC `request.jwt.claims`, que es de sesión. `SECURITY
  DEFINER` cambia el rol, **no** el GUC — así que dentro del trigger `auth.uid()`
  sí devuelve el usuario que llamó.
- Pero el trigger también puede dispararse desde `service_role`, donde
  `auth.uid()` es `null`. Una guardia basada en `auth.uid()` bloquearía flujos
  administrativos legítimos y, peor, no cubriría el sujeto correcto: el dueño de
  la fila es `new.id_usuario`, no quien escribe.

Por eso hace falta una variante parametrizada por usuario, en
`supabase/sql/070_…` junto a lo anterior:

```sql
create or replace function private.tiene_acceso_vigente_curso_de(
  p_id_usuario uuid, p_id_curso uuid
) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.inscripciones
     where id_usuario = p_id_usuario and id_curso = p_id_curso
       and tipo_acceso = 'CORTESIA' and activo = true
  )
  or (
    private.suscripcion_da_acceso(p_id_usuario)
    and (
      coalesce((select mostrado from public.cursos where id = p_id_curso), false)
      or exists (
        select 1 from public.progreso pr
        join public.lecciones l on l.id = pr.id_leccion
        join public.modulos m on m.id = l.id_modulo
        where pr.id_usuario = p_id_usuario and m.id_curso = p_id_curso
      )
    )
  );
$$;
revoke execute on function private.tiene_acceso_vigente_curso_de(uuid, uuid) from anon, authenticated;
```

y en `private.emitir_certificado()`, justo después de la comprobación de
certificado ya existente:

```sql
if not private.tiene_acceso_vigente_curso_de(p_id_usuario, p_id_curso) then
  return;
end if;
```

> Ojo con no romper `030_acceso_curso_despublicado.sql`: la rama de membresía
> exige `mostrado OR tiene progreso en el curso`. Un estudiante que iba a mitad
> de un curso que luego se despublicó conserva el acceso porque ya tiene
> progreso. La función de arriba replica esa regla; no la simplifiques.

#### 0.3 Pruebas — el hueco de la prueba y el de la policy son el mismo

`scripts/rls-test.ts` cubre lectura cruzada de `progreso` (líneas 313, 403, 508)
y escritura de `inscripciones` sin acceso (líneas 430-434), pero **no había ni
una prueba de escritura en `progreso` desde el cliente sin acceso**. Añadir,
junto a las de `inscripciones`:

```
"estudiante sin acceso NO puede insertar progreso en una lección de pago"
"estudiante sin acceso SÍ puede insertar progreso en la lección introductoria"
"estudiante sin acceso NO puede marcar completada una lección de pago"
"completar todas las lecciones sin acceso NO emite certificado"
"estudiante con acceso sigue pudiendo guardar y completar progreso"   (regresión)
"membresía con progreso en curso despublicado sigue pudiendo guardar" (regresión de 030)
```

Las dos últimas son las que impiden que este arreglo rompa el producto. La de
`030` no la pude verificar contra la base actual porque ningún usuario tiene hoy
progreso en un curso despublicado — el escenario hay que construirlo en la
prueba, y `rls-test.ts:630-640` ya sabe montarlo.

**Criterio de aceptación:** `npm run test:rls` en verde con 130/130, y la
simulación del informe (§3 de la auditoría) devolviendo `permite = false` para
una lección no introductoria.

---

### Lote 1 — Restricciones, triggers y purga. Barato y sin riesgo

**Cierra:** D-6, D-8, D-9. Media hora de trabajo. `cupones` está en **0 filas**:
es el momento más barato posible para ponerle restricciones, sin backfill ni
validación de datos existentes.

#### 1.1 `071_restricciones_faltantes.sql` (D-6)

Patrón idempotente de `042`: `drop constraint if exists` + `add constraint`.

```sql
alter table public.cupones drop constraint if exists cupones_valor_no_negativo;
alter table public.cupones add constraint cupones_valor_no_negativo
  check (valor >= 0);

alter table public.cupones drop constraint if exists cupones_porcentaje_max_100;
alter table public.cupones add constraint cupones_porcentaje_max_100
  check (tipo_descuento <> 'PORCENTAJE' or valor <= 100);

alter table public.cupones drop constraint if exists cupones_limite_usos_positivo;
alter table public.cupones add constraint cupones_limite_usos_positivo
  check (limite_usos is null or limite_usos >= 1);

alter table public.cupones drop constraint if exists cupones_usos_dentro_del_limite;
alter table public.cupones add constraint cupones_usos_dentro_del_limite
  check (limite_usos is null or veces_usado <= limite_usos);

alter table public.codigos_invitacion drop constraint if exists codigos_usos_dentro_del_limite;
alter table public.codigos_invitacion add constraint codigos_usos_dentro_del_limite
  check (veces_usado <= limite_usos);

alter table public.codigos_invitacion drop constraint if exists codigos_duracion_positiva;
alter table public.codigos_invitacion add constraint codigos_duracion_positiva
  check (duracion_dias >= 1);

alter table public.lotes_codigos_invitacion drop constraint if exists lotes_cantidad_positiva;
alter table public.lotes_codigos_invitacion add constraint lotes_cantidad_positiva
  check (cantidad >= 1 and duracion_dias >= 1);

alter table public.planes drop constraint if exists planes_duracion_positiva;
alter table public.planes add constraint planes_duracion_positiva
  check (duracion_dias >= 1);

alter table public.suscripciones drop constraint if exists suscripciones_renovacion_posterior;
alter table public.suscripciones add constraint suscripciones_renovacion_posterior
  check (fecha_renovacion is null or fecha_renovacion > fecha_inicio);

alter table public.intentos_examen drop constraint if exists intentos_expira_posterior;
alter table public.intentos_examen add constraint intentos_expira_posterior
  check (expira_en is null or expira_en > iniciado_en);

alter table public.progreso drop constraint if exists progreso_segundo_no_negativo;
alter table public.progreso add constraint progreso_segundo_no_negativo
  check (segundo_actual >= 0);

alter table public.lecciones drop constraint if exists lecciones_duracion_no_negativa;
alter table public.lecciones add constraint lecciones_duracion_no_negativa
  check (duracion is null or duracion >= 0);
```

> **Antes de aplicar**, correr cada `check` como `SELECT count(*) … WHERE NOT (…)`
> sobre los datos actuales. `db:rls` va en una sola transacción: un `CHECK` que
> no valida tumba **los 70 scripts**, no solo el suyo. Con los datos de hoy
> ninguno debería fallar, pero eso se comprueba, no se supone.

#### 1.2 `072_actualizado_en_examenes.sql` (D-8)

Las tres tablas de exámenes tienen la columna y les falta el trigger; `067_examenes.sql`
no lo incluyó.

```sql
drop trigger if exists set_actualizado_en on public.examenes;
create trigger set_actualizado_en before update on public.examenes
  for each row execute function private.actualiza_actualizado_en();

drop trigger if exists set_actualizado_en on public.preguntas_examen;
create trigger set_actualizado_en before update on public.preguntas_examen
  for each row execute function private.actualiza_actualizado_en();

drop trigger if exists set_actualizado_en on public.intentos_examen;
create trigger set_actualizado_en before update on public.intentos_examen
  for each row execute function private.actualiza_actualizado_en();
```

#### 1.3 `073_cron_purga_rate_limit.sql` (D-9)

`public.limpiar_intentos_rate_limit()` ya existe; lo que falta es que se ejecute
sola. Seis tablas de `private` guardan correos e IP bajo Ley 1581 y hoy dependen
de que alguien corra `npm run rate-limit:limpiar` a mano.

```sql
select cron.unschedule('limpiar-rate-limit')
 where exists (select 1 from cron.job where jobname = 'limpiar-rate-limit');

select cron.schedule('limpiar-rate-limit', '30 3 * * *',
  $$select public.limpiar_intentos_rate_limit()$$);
```

**Criterio de aceptación del lote:** `db:rls:check` en verde; una prueba por
`CHECK` nuevo que intente el `INSERT` prohibido y falle; `UPDATE` sobre un examen
deja `actualizado_en > creado_en`; `select * from cron.job` muestra 3 filas
activas y al día siguiente `cron.job_run_details` registra la corrida.

---

### Lote 2 — Reducir exposición

**Cierra:** D-5, D-7, D-14, D-15, D-16. Un archivo, `074_endurece_exposicion.sql`.

- **D-5** — reconstruir `comentarios_autor_publico` sustituyendo `rol` por
  `(rol = 'PROFESOR') as es_profesor`. La UI necesita el check de profesor
  verificado; no necesita decirle a `anon` qué cuenta es administradora.
  *Requiere tocar los consumidores de la vista en `src/` — buscar `rol` en los
  componentes de comentarios antes de aplicar.*
- **D-7** — trigger `before update or delete` sobre `bitacora_administrativa`
  que lance `42501`. A diferencia de una policy, un trigger **sí** se dispara
  para `service_role`, que es justamente el cliente con el que la aplicación
  escribe. Y en `src/lib/admin/bitacora.ts:20`, capturar el error del `insert` y
  emitirlo con `logError("bitacora", …)`: hoy una acción administrativa puede
  completarse sin entrada de auditoría sin que nadie se entere.
- **D-14** — `revoke execute on function public.curso_esta_completo(uuid),
  public.lecciones_completas_curso(uuid) from anon;`
- **D-15** — acotar `instructores_select_publico`: hoy es `using (true)` y
  expone `id_perfil_profesor` (un UUID de cuenta real) a `anon`.
- **D-16** — tres líneas de `if not private.es_administrador() then raise` al
  inicio de `admin_listar_usuarios`. No hay fuga hoy (la RLS de `perfiles` la
  recorta, verificado), pero una función `admin_*` que cualquiera puede invocar
  es una trampa para el próximo cambio.

**Criterio de aceptación:** como `anon`, `comentarios_autor_publico` no devuelve
ninguna columna con valor `ADMINISTRADOR`; con el cliente de `service_role`, un
`UPDATE` y un `DELETE` sobre la bitácora fallan con `42501`; un estudiante
llamando `admin_listar_usuarios` recibe error de permisos en vez de una lista vacía.

---

### Lote 3 — Ruta de supresión de datos (D-4, P1)

**Cierra:** D-4. Es el más grande de los cuatro P0/P1 y el único que no urge
hasta que haya usuarios reales — pero condiciona una política de privacidad que
**ya está redactada** (`docs/legal/contenido-soporte.md:364`) y que promete el
derecho de supresión de la Ley 1581.

Hoy 8 de 9 usuarios no se pueden borrar: diez tablas referencian `perfiles` con
`ON DELETE RESTRICT`, y basta una fila en `suscripciones` para bloquear la cuenta.

**No es un `DELETE`, es anonimización.** `pagos` y `certificados` tienen valor
contable y probatorio legítimo:

| Tabla | Acción |
|---|---|
| `perfiles` | `nombre`→`'Usuario eliminado'`, `correo`→`'anon+<hash>@uva.invalid'`; `celular`, `especialidad`, `pais`→NULL; sellar `anonimizado_en` (columna nueva, vía Prisma) |
| `comentarios` | conservar fila, vaciar `contenido` — el trigger `comentarios_contenido_solo_se_vacia` ya lo permite — y marcar `eliminado` |
| `progreso`, `intentos_examen` | borrar; no tienen valor probatorio |
| `certificados` | **conservar**: `nombre_estudiante` ya es un snapshot congelado, exactamente lo que un certificado debe preservar para seguir siendo verificable |
| `suscripciones`, `pagos` | conservar por obligación contable; ya no contienen datos personales directos |
| `bitacora_administrativa` | conservar; `RESTRICT` ahí es correcto |
| `auth.users` | `supabase.auth.admin.deleteUser()` al final |

Implementar como una única `private.anonimizar_usuario(uuid)` transaccional,
invocada por una Server Action de administrador y registrada en la bitácora.

**Criterio de aceptación:** prueba en `rls-test.ts` que crea un usuario
desechable con progreso, comentario y certificado, lo anonimiza y comprueba:
cero PII en `perfiles`, el certificado **sigue** verificable con
`verificar_certificado()`, el comentario existe con contenido vacío, y
`auth.users` ya no tiene la fila.

---

### Lote 4 — Rendimiento de RLS (D-3, P1)

**Cierra:** D-3. Hacerlo **antes** de que crezca el catálogo, no cuando la
pantalla del reproductor ya vaya lenta. Medición de partida, a conservar para
comparar: leer 20 comentarios de una tabla de 29 filas cuesta hoy
**1 613 buffers y 11,8 ms**, y `es_leccion_introductoria` sola cuesta
**605 buffers / 3,5 ms** por 29 filas (21 buffers por fila).

Dos cambios, en este orden:

1. **Materializar la lección introductoria.** Es un dato que cambia al reordenar
   el temario, no al leer un comentario. `es_leccion_introductoria()` no es
   cacheable —depende de la fila— y cada llamada une `lecciones` con `modulos`
   de todo el curso y ordena.
   - Migración **de Prisma** (no `supabase/sql/`, ver §0.4):
     `lecciones.es_introductoria boolean not null default false` + índice parcial.
   - Trigger que la mantenga, enganchado también a `reespaciar_orden_lecciones`
     y `reespaciar_orden_modulos`, que ya existen.
   - Reescribir las policies para que referencien la columna en vez de llamar a
     la función.
2. **Envolver los helpers restantes en subconsulta escalar**, extendiendo a
   `es_administrador()` y `tiene_acceso_vigente_curso()` el patrón que `056`
   aplicó solo a `auth.uid()`:
   `private.es_administrador()` → `(select private.es_administrador())`.
   Son `STABLE`, pero Postgres no las promueve a InitPlan por sí solo: las
   evalúa por fila dentro del `Filter`. El linter de Supabase tampoco lo ve —
   solo reconoce `auth.<fn>()` literal, por eso reporta 1 caso y se le escapan
   las ~40 policies restantes.

**Nota de despliegue:** el índice parcial de este lote cabe hoy en `db:rls`
porque las tablas son diminutas. Cuando `lecciones` tenga volumen real, un
índice nuevo necesita `CONCURRENTLY` y **no puede vivir en `supabase/sql/`**
(§0.1). Ese será el primer caso que obligue a resolver D-11.

**Criterio de aceptación:** repetir el `EXPLAIN (ANALYZE, BUFFERS)` del informe;
`shared hit` por debajo de 100, y `es_administrador` /
`tiene_acceso_vigente_curso` apareciendo como `InitPlan`, no dentro de un
`Filter` por fila. `npm run test:rls` sigue en verde: el cambio es de
rendimiento, no de semántica.

---

### Lote 5 — Deuda programada

**Cierra:** D-10, D-11, D-12, D-13. Sin urgencia, con coste creciente.

- **D-10** — añadir `and pr_1.id_usuario = (select auth.uid())` al lateral y a
  la CTE `cursos_tocados` de `progreso_cursos_estudiante`. Hoy es correcta *por
  accidente* (la RLS recorta antes); para un administrador —que sí tiene policy
  de lectura amplia sobre `progreso`— devuelve `bool_or` sobre el progreso de
  todos: "lecciones completadas" pasa a significar "que completó alguien".
- **D-11** — tres pasos, por orden de coste: (a) que `apply-rls.ts` **registre**
  cada archivo aplicado en `private.rls_aplicados`, no solo lo ejecute — sin eso
  no hay forma de auditar el estado real de un proyecto restaurado, que es
  justo lo que D-2 necesita; (b) declarar en la cabecera de cada `supabase/sql/`
  la migración de Prisma mínima que requiere, y verificarlo contra
  `_prisma_migrations` antes de ejecutar; (c) `down.sql` al menos para las
  migraciones baratas de revertir, documentando por qué las demás no lo tienen.
  Incluir aquí el drift ya existente de `perfiles.pais` (§0.4).
- **D-12** — retención para `eventos_webhook` (90 días tras procesado; guarda
  cargas útiles de pasarelas) y `mux_assets_pendientes_eliminacion` (30 días
  tras `eliminado_en`). Van al mismo job de `pg_cron` del Lote 1.
- **D-13** — decidir si la pantalla de códigos necesita Realtime. Es el mayor
  coste atribuible a la aplicación hoy: **74 792 llamadas / 357 s** de
  decodificación de WAL con ~0 usuarios. No es un problema de seguridad (la RLS
  se aplica), pero crear un lote de 500 códigos genera 500 eventos con
  evaluación de RLS por evento y por suscriptor. Si no hace falta al segundo,
  sacar `codigos_invitacion` de la publicación y recargar bajo demanda.

---

## 3. Trazabilidad

Cerrado el 2026-09-08. Todo lo de abajo está aplicado en firme contra la base
real (`eoewtxnheblzsspnubvt`) y reverificado el mismo día en una segunda
pasada independiente (§5): releída cada definición SQL resultante contra el
catálogo (`pg_policies`, `pg_proc`, `pg_trigger`, `cron.job`,
`pg_publication_tables`), no solo contra el archivo fuente.

| Hallazgo | Sev. | Lote | Estado |
|---|---|---|---|
| D-1 progreso sin control de acceso | P0 | 0 | ✅ cerrado — `070`, verificado en catálogo y con `test:rls` |
| D-2 simulacro de restauración | P1 | — | **postergado (Pro)** + interina §1.1 sin ejecutar |
| D-3 helpers de RLS por fila | P1 | 4 | ✅ cerrado — `076`+`077`; ver nota de rendimiento en §5.2 |
| D-4 supresión imposible | P1 | 3 | ✅ cerrado — `075`, 8 pruebas incl. idempotencia |
| D-5 `rol` expuesto a `anon` | P2 | 2 | ✅ cerrado — `074`, columna `rol` ya no existe en la vista |
| D-6 `CHECK` faltantes | P2 | 1 | ✅ cerrado — `071`, 12/12 en el catálogo |
| D-7 bitácora mutable / error mudo | P2 | 2 | ✅ cerrado — `074`, trigger alcanza a `service_role` |
| D-8 triggers `actualizado_en` | P2 | 1 | ✅ cerrado — `072`, 3/3 en `pg_trigger` |
| D-9 purga de rate-limit | P2 | 1 | ✅ cerrado — `073`, cron activo |
| D-10 vista agrega progreso ajeno | P2 | 5 | ✅ cerrado — `078` |
| D-11 dos sistemas de migración | P2 | 5 | ✅ cerrado — registro en `private.rls_aplicados` (81/81) + directiva `requiere-migracion` verificada en `apply-rls.ts` |
| D-12 retención de webhooks/assets | P3 | 5 | ✅ cerrado — `079`, cron activo |
| D-13 coste de Realtime | P3 | 6 | ✅ cerrado — `080`, tabla fuera de `supabase_realtime` |
| D-14 RPC ejecutables por `anon` | P3 | 2 | ✅ cerrado — `074`; el aviso del linter ya no aparece |
| D-15 `instructores` con `using (true)` | P3 | 2 | ✅ cerrado — `074`, tabla cerrada a solo admin |
| D-16 `admin_listar_usuarios` sin rol | P3 | 2 | ✅ cerrado — `074`, guard verificado con `test:rls` |
| Contraseñas filtradas (linter) | WARN | — | **postergado (Pro)**, ya decidido en `887ec09` |

**Lote 6 (no estaba en el plan original):** D-13 se cerró aparte, tras
confirmar con el usuario que la pantalla de códigos de invitación no necesita
actualización en vivo. Ver `supabase/sql/080_quita_realtime_codigos_invitacion.sql`.

---

## 4. Orden de ejecución y riesgo

| Lote | Riesgo | Puede romper |
|---|---|---|
| 0 | **medio** | El flujo de guardado de progreso. Es el único lote que cambia una ruta de escritura que los usuarios usan a diario. Las dos pruebas de regresión de §0.3 existen exactamente para esto. |
| 1 | bajo | Solo si un `CHECK` no valida contra datos existentes — de ahí el `SELECT count(*) WHERE NOT (…)` previo. Recordar que los 70 scripts van en una transacción. |
| 2 | bajo | La UI de comentarios, si consume `rol` de la vista. Revisar `src/` antes. |
| 3 | medio | Nada existente: es funcionalidad nueva. |
| 4 | bajo | Nada semántico; es reescritura de predicados a igualdad de resultado. `test:rls` es el testigo. |
| 5 | bajo | — |

**Después de cada lote:** `npm run db:rls:check` (aplica y revierte), luego
`npm run db:rls`, luego `npm run test:rls`. Y al terminar el Lote 0, volver a
correr la simulación de la auditoría: es la prueba de que el P0 quedó cerrado
contra la base real, no solo contra el script de pruebas.

---

## 5. Verificación de cierre (2026-09-08, segunda pasada independiente)

El usuario pidió releer todo el plan y comprobar que quedó sin errores ni
solapamientos antes de dar el trabajo por terminado. Esto no fue relectura de
los archivos — fue verificación contra el estado real de la base:
`pg_policies`, `pg_proc`, `pg_trigger`, `cron.job`, `pg_publication_tables`,
`_prisma_migrations`, `private.rls_aplicados`, y los advisors de seguridad y
rendimiento de Supabase, comparados hallazgo por hallazgo contra el estado
documentado en la auditoría original.

### 5.1 Solapamientos entre los 11 archivos nuevos (070-080)

- **Sin duplicados de prefijo numérico** en `supabase/sql/`.
- **Dos policies se redefinen dos veces** entre los archivos nuevos —
  `progreso_insert_propio` y `progreso_update_propio`, en `070` y luego en
  `076` — y es intencional: `076` se aplica después y solo cambia
  `es_leccion_introductoria(id_leccion)` por la columna materializada
  `es_introductoria`. Diff línea por línea entre ambas versiones: **la única
  diferencia es esa**, el chequeo de acceso de `070` se conserva intacto.
- La vista `comentarios_autor_publico` se redefine en `074` y `076` por el
  mismo motivo (refinamiento incremental); mismo diff, mismo resultado: la
  versión final tiene ambos fixes (D-5 + D-3).
- `077` declara explícitamente en su cabecera que excluye las 4 policies que
  `076` ya fija — verificado que no las toca.
- **Cero funciones con el mismo nombre y firma distinta** en `public`/`private`
  (ningún overload accidental).
- `emitir_certificado` (068→070) y `admin_listar_usuarios` (037→040→054→074)
  son las únicas funciones con historia previa a esta ronda; diff del cuerpo
  de cada una contra su versión inmediatamente anterior: **idéntico salvo por
  la guardia añadida**, ningún fix acumulado se perdió.
- Los 3 triggers `set_actualizado_en` nuevos (`072`) no colisionan con nada:
  los ya existentes los genera Prisma en las migraciones (`@updatedAt`), no
  `supabase/sql/`, y el nombre de trigger es único por tabla en Postgres.

### 5.2 Nota de rendimiento sobre D-3 (importante, no oculto)

Al repetir el `EXPLAIN (ANALYZE, BUFFERS)` original contra la base ya
migrada, la **primera** medición dio *peor* tiempo que el original (22,5 ms
vs. 11,8 ms), aunque menos buffers. Antes de reportarlo como éxito lo
investigué: era ruido de caché fría, tomado justo después de aplicar 80
sentencias DDL seguidas. Repitiendo la misma consulta con caché caliente
(tercera ejecución consecutiva): **433 buffers, 13,6 ms** — 73% menos buffers
que el original, tiempo comparable. El objetivo declarado (que
`es_leccion_introductoria()` deje de escanear el temario por fila) se
cumplió; ya no aparece en ningún plan.

**Hallazgo menor que queda como deuda, no bloqueante:** el plan sigue
mostrando `cursos` escaneada de forma independiente varias veces dentro de la
misma consulta — redundancia estructural entre `cursos_select_publicos` y
`tiene_acceso_vigente_curso` (que se retroalimentan) que ya existía antes de
esta ronda y que separar el predicado en dos `EXISTS` no elimina. Irrelevante
al volumen actual (4 filas en `cursos`); merecería revisión aparte si el
catálogo crece a cientos de cursos. No se abre como hallazgo `D-17` porque no
es una regresión de este trabajo — es preexistente y documentado aquí para
que no se pierda.

### 5.3 Verificación puntual en el catálogo, por hallazgo

Confirmado con `SELECT` directo (no solo "el script corrió sin error"):

- D-1: `with_check` de ambas policies de `progreso` contiene
  `tiene_acceso_vigente_curso` y `es_introductoria`.
- D-3: **0** policies en `public` con `es_administrador()` sin envolver en
  `(select …)` (la primera comprobación dio un falso positivo — 84 — por
  buscar el texto en minúsculas; Postgres normaliza la subconsulta guardada
  a `( SELECT … AS alias)`. Corregido el patrón, confirmado en 0).
- D-4: `anonimizar_usuario` existe en `public` y `private`;
  `perfiles.anonimizado_en` existe.
- D-5: la vista no tiene columna `rol`; sí tiene `es_profesor`.
- D-6/D-8/D-9/D-12: los 12 `CHECK`, los 3 triggers y los 2 `cron.job`
  (`limpiar-rate-limit`, `purgar-webhooks-y-assets`) existen y están activos.
- D-10: la vista referencia `auth.uid()` en su definición.
- D-11: `private.rls_aplicados` tiene 81 filas, orden 0-80 sin huecos.
- D-13: `pg_publication_tables` no tiene ninguna tabla de `public` en
  `supabase_realtime`.
- D-14: el aviso `anon_security_definer_function_executable` (2 hallazgos en
  la auditoría original) ya no aparece en el advisor de seguridad.
- D-15: `instructores_select_admin` existe; `instructores_select_publico` ya
  no.
- D-16: `pg_get_functiondef` de `admin_listar_usuarios` contiene el mensaje
  de guardia (además de ya probado con `test:rls`).

### 5.4 Advisors de Supabase, antes/después

- `anon_security_definer_function_executable`: 2 hallazgos → **0** (D-14).
- `auth_rls_initplan`: 1 hallazgo (`comentario_moderacion`) → **0** (D-3/077).
- `authenticated_security_definer_function_executable`: 5 → 6. La nueva es
  `anonimizar_usuario`, esperada por diseño (comprueba el rol en su cuerpo).
- `rls_enabled_no_policy`: 7 → 8. La nueva es `private.rls_aplicados` (D-11),
  sin `GRANT` a `anon`/`authenticated` — verificado con `SET ROLE anon`, que
  da `permission denied` antes de que RLS siquiera se evalúe.
- `unused_index`: 20 → 21. La nueva es `perfiles_anonimizado_en_idx` (D-4),
  sin uso porque aún no hay cuentas anonimizadas reales — no accionable.
- `auth_leaked_password_protection`: sin cambio, postergado (Pro).

### 5.5 Suite de pruebas, estado final

`tsc`, `eslint`, `vitest` (260/260) y `test:rls` (**172/172**, sin
advertencias) en verde contra la base real. `npm run db:rls:check` limpio dos
veces seguidas (la segunda vez sirvió, sin buscarlo, como prueba de que
reaplicar los 81 scripts sobre una base ya al día es idempotente).

**Conclusión:** los 17 hallazgos que correspondían a este plan (D-1 y
D-3 a D-16, más D-13 del Lote 6) están cerrados y verificados contra el
catálogo real, no solo contra el archivo fuente. D-2 y la protección de
contraseñas filtradas siguen postergados por decisión explícita del usuario
(plan Pro). El único ítem que queda anotado sin resolver es la redundancia
estructural de §5.2, preexistente y no bloqueante.
