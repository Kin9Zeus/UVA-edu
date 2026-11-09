# Respaldos: confirmación, simulacro de restauración y RPO/RTO

"Un respaldo que nunca se restauró no es un respaldo, es una suposición."
(tarea "Monitoreo, alertas, respaldo de base de datos y plan de reversión").
Este documento es el procedimiento a seguir — no reemplaza el simulacro,
lo prepara para que sea barato de ejecutar y quede con evidencia.

Nada de esto se puede hacer desde el código ni desde una sesión sin acceso
al dashboard de Supabase: quien lo corra necesita permisos de owner/admin
sobre el proyecto (y sobre la organización, para crear uno nuevo en la
Parte B).

## Parte A — Confirmar el plan contratado y la frecuencia real

1. Entrar a **Project Settings → Backups** (o **Database → Backups**,
   según la versión del dashboard) en el proyecto real de Supabase.
2. Anotar acá:
   - **Plan:** _______ (Free / Pro / Team / Enterprise)
   - **Tipo de respaldo:** _______ (respaldo diario lógico / Point-in-Time
     Recovery)
   - **Retención real:** _______ días (no la retención "de folleto" del
     plan — la que muestra el panel para este proyecto específico)
   - **Hora del último respaldo exitoso:** _______
3. Si el plan es Free: Supabase **no ofrece respaldos automáticos** en ese
   nivel — si este es el caso, es el hallazgo más urgente de todo este
   documento, y hay que decidir si se sube de plan antes del lanzamiento,
   no después.

No se documentan acá cifras de retención por plan a propósito: Supabase
las cambia con el tiempo y lo único que vale es lo que el panel muestra
para este proyecto, no lo que diga esta guía dentro de unos meses.

## Parte B — Simulacro de restauración

Uno de los tres criterios de "terminado" de la tarea es que esto se haya
ejecutado de verdad, no solo escrito. Repetirlo cada vez que cambie algo
grande en el esquema (o al menos una vez por fase) es lo que lo mantiene
siendo evidencia y no un trámite de una sola vez.

1. Crear un **proyecto Supabase nuevo y vacío** (misma organización,
   nombre que deje claro que es un simulacro — ej. `uva-simulacro-restauracion`).
2. Desde el proyecto real, restaurar el **último respaldo automático**
   sobre el proyecto nuevo (Backups → Restore, o el flujo de PITR si
   aplica).
3. Contra el proyecto restaurado, en este orden (mismos comandos que usa
   `ci.yml` para el proyecto de prueba):
   ```
   npm run prisma:deploy   # DATABASE_URL apuntando al proyecto restaurado
   npm run db:rls
   npm run test:rls
   ```
   El paso `db:rls` + `test:rls` es el que de verdad importa. Un respaldo
   diario de Supabase es un `pg_dump` lógico del proyecto completo, y las
   ~69 políticas de RLS son catálogo de Postgres (`CREATE POLICY`,
   `ALTER TABLE … ENABLE ROW LEVEL SECURITY`) igual que las tablas: en
   principio **sí** vuelven con la restauración, no hay que asumir que no.

   Lo que sí puede no volver igual es que coincidan con lo que está
   versionado en `supabase/sql/` — el README de este repo prohíbe cambiar
   RLS desde el panel de Supabase precisamente porque un cambio hecho ahí
   queda fuera de control de versiones, y si alguna vez se rompió esa
   regla, el respaldo capturó ese estado no versionado, no el que describe
   el repositorio. `db:rls` reaplica los scripts numerados de punta a punta
   y es idempotente, así que correrlo después de restaurar no reintroduce
   nada — al contrario, hace converger el proyecto restaurado a exactamente
   lo que hay en el repo, que es lo único que de verdad se puede auditar y
   reproducir. Y `test:rls` es la prueba de que esa convergencia funcionó:
   si no pasa en verde contra el proyecto restaurado, el simulacro fracasó
   aunque los datos se hayan visto bien. El escenario real de desastre no
   es "perdimos los datos", es "restauramos y quedó todo abierto".
4. **Cronometrar el total**, desde que se pidió la restauración hasta que
   `test:rls` terminó en verde. Ese número — no una estimación — es el
   **RTO** (Recovery Time Objective real, no el de aspiración).
5. **Anotar la antigüedad del respaldo restaurado** (hora del respaldo
   menos hora del incidente simulado). Ese es el **RPO** real: cuánto
   trabajo de un usuario se perdería en el peor caso.
6. Borrar el proyecto de simulacro cuando se termine — no dejarlo
   corriendo (cuesta dinero y es una segunda copia de datos reales dando
   vueltas).

### Resultado del simulacro (llenar después de correrlo)

| Campo | Valor |
|---|---|
| Fecha del simulacro | |
| Quién lo corrió | |
| Antigüedad del respaldo restaurado (RPO) | |
| Tiempo total de restauración (RTO) | |
| `test:rls` pasó en el proyecto restaurado? | |
| Datos que se habrían perdido en el peor caso | |
| Proyecto de simulacro borrado al terminar? | |

## Parte C — Qué se pierde en el peor caso

Con solo respaldos diarios (sin PITR), el peor caso es perder **hasta un
día completo** de:
- Progreso de video de cada estudiante (`progreso.segundo_actual`) — un
  estudiante podría tener que volver a ver desde donde iba.
- Códigos de invitación canjeados ese día y cuentas creadas ese día — un
  estudiante que se registró horas antes del incidente podría desaparecer
  de la base restaurada.
- Comentarios y certificados emitidos ese día.
- Eventos de webhook (`Eventos_Webhook`) recibidos ese día — un pago o un
  video procesado podría quedar sin reflejarse, y ni el respaldo ni el
  webhook original (ya consumido por el proveedor) lo van a repetir solo.

Si el proyecto tiene **PITR** activo, este peor caso baja a minutos en vez
de a un día — por eso la Parte A pregunta explícitamente si el respaldo es
diario o PITR, no solo si "hay respaldos".

## Parte D — Respaldo propio fuera de Supabase (fase 11.3)

Los respaldos de las partes A y B viven **dentro** de Supabase: si se
pierde la cuenta, el proyecto queda suspendido o alguien lo borra con una
llave robada, se van con él. Esta copia vive en otro proveedor.

Lo hace `.github/workflows/respaldo.yml`, todos los días a las 4:20 de
Colombia. **Está apagado** hasta completar los pasos de abajo: mientras
falte un secreto, termina en verde con un aviso y no copia nada.

### Qué copia y qué no cubre

| Copia | Formato |
| --- | --- |
| `public` y `private`: tablas, datos, RLS, funciones, triggers | `pg_dump` completo |
| `auth` (cuentas, identidades, factores de 2FA) y `storage` (metadatos de archivos) | Solo datos: el esquema lo crea Supabase en el proyecto nuevo |

**No cubre los archivos de los buckets** (avatares, adjuntos, portadas,
certificados, materiales). Los certificados se pueden volver a generar; los
demás no. Copiarlos es un paso aparte, todavía pendiente.

Tampoco los videos: viven en Mux, no en Supabase.

### Cómo encenderlo (una vez; lo hace un administrador del repo)

1. **Almacenamiento:** crear un bucket en un proveedor que no sea Supabase
   ni Railway. Cloudflare R2 encaja (10 GB gratis, sin cobro por bajar).
   - Un bucket **aparte** del de registros (`uva-respaldos`), clase
     Standard.
   - Regla de vida: borrar los objetos de `diario/` a los 35 días.
   - **Regla de bloqueo** (Bucket lock rules) sobre `diario/` de 35 días.
     R2 no tiene llaves "solo de escritura": el bloqueo es lo que impide
     que una llave robada borre los respaldos.
   - Una llave de cuenta (Account API token) con Object Read & Write solo
     para ese bucket.
2. **Llave de cifrado:** en un computador de confianza, `age-keygen -o
   uva-respaldo.key`. La línea `# public key: age1…` es la pública. **El
   archivo completo (la privada) va al gestor de contraseñas y se borra del
   computador.** Sin ella ningún respaldo se puede abrir: guardarla en dos
   lugares.
3. **Usuario de solo lectura en producción**, desde el SQL Editor de
   Supabase (producción), **el mismo día que se configura el paso 4**: la
   contraseña va directo al gestor y al secreto de GitHub.
   ```sql
   create role respaldo_lector with login password '<generada, 32+ caracteres>' bypassrls;
   grant pg_read_all_data to respaldo_lector;
   ```
   Probado en staging el 2026-11-06 (y borrado después):
   - **Permisos tabla por tabla no sirven.** Supabase deja a `postgres`
     entrar al esquema `auth` pero no compartir ese acceso (`postgres=U`,
     sin `*`): el `grant usage` se ignora con un aviso y el respaldo saldría
     sin las cuentas. Por eso `pg_read_all_data`, el rol estándar de
     Postgres que `postgres` sí puede otorgar (lo mismo que usa el
     `supabase_read_only_user` de Supabase).
   - Con él lee `auth.users`, `identities`, `mfa_factors`, `public`,
     `private` y `storage`. `bypassrls` porque `pg_dump` se niega a copiar
     una tabla que RLS le filtraría.
   - **No puede escribir:** un `update` sobre `perfiles` dio "permission
     denied".
   - Para borrarlo: `grant respaldo_lector to postgres with inherit true,
     set true; drop owned by respaldo_lector; revoke respaldo_lector from
     postgres; drop role respaldo_lector;`

   Va sin esto en `supabase/sql/`, a propósito: esos scripts se aplican
   también en staging y en el CI, y este usuario solo existe en producción.
4. **Environment `respaldo-produccion`** en GitHub (Settings →
   Environments), **limitado a la rama master** y sin revisores (un
   respaldo programado no puede esperar una aprobación). Sus secretos:

   | Secreto | Valor |
   | --- | --- |
   | `RESPALDO_DATABASE_URL` | Conexión de `respaldo_lector` (pooler de sesión, puerto 5432) |
   | `RESPALDO_AGE_PUBLICA` | La línea `age1…` del paso 2 |
   | `RESPALDO_S3_ENDPOINT` | `https://<cuenta>.r2.cloudflarestorage.com` |
   | `RESPALDO_S3_BUCKET` | Nombre del bucket |
   | `RESPALDO_S3_LLAVE_ID` / `RESPALDO_S3_LLAVE_SECRETA` | La llave del paso 1 |
5. Correrlo a mano (Actions → Respaldo propio de la base → Run workflow) y
   comprobar que aparece el archivo en el bucket.
6. Anotar los seis secretos en la tabla de
   `salida-de-miembro-y-cambio-de-llaves.md`.

### Restaurar (cada mes, en staging)

1. Bajar el último `uva-<fecha>.tar.age` y descifrarlo:
   `age -d -i uva-respaldo.key uva-<fecha>.tar.age | tar -xf -`.
2. En un proyecto de Supabase **de prueba** (staging o uno creado para el
   simulacro, nunca producción):
   ```
   pg_restore --no-owner --no-privileges --clean --if-exists -d "<url de prueba>" app.dump
   pg_restore --no-owner --no-privileges --data-only --disable-triggers -d "<url de prueba>" cuentas.dump
   npm run db:rls && npm run test:rls     # con ENV_FILE apuntando a esa base
   ```
3. Contar filas de tres tablas grandes (`perfiles`, `progreso`,
   `inscripciones`) contra producción.
4. Borrar los archivos descifrados (`shred -u app.dump cuentas.dump`) y
   anotar el resultado en la tabla de abajo.

El primer simulacro va a mostrar ajustes (el orden de `cuentas.dump`, un
permiso que falte): corregir este documento con lo que pase de verdad.

| Fecha | Quién | Respaldo usado | ¿`test:rls` en verde? | Tiempo total | Notas |
| --- | --- | --- | --- | --- | --- |
| | | | | | |
