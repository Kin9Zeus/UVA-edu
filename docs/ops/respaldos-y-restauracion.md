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
   El paso `db:rls` + `test:rls` es el que de verdad importa: una base
   restaurada vuelve con sus tablas, pero **sin ninguna de las ~69
   políticas de RLS** (viven en `supabase/sql/`, no en el respaldo de
   datos). El escenario real de desastre no es "perdimos los datos", es
   "restauramos y quedó todo abierto". Si `test:rls` no pasa en verde
   contra el proyecto restaurado, el simulacro fracasó aunque los datos
   se hayan visto bien.
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
