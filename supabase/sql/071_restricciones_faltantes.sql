-- ============================================================
-- Restricciones CHECK que faltaban
-- Cierra AUDIT-2026-09-08-base-de-datos.md — D-6 (P2).
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-070.
--
-- 042_restricciones_dinero_y_proveedor.sql fue riguroso con el dinero de
-- `planes`, `pagos`, `planes_precios` y `suscripciones` — y se saltó la tabla
-- que aplica los descuentos. Hoy `cupones.valor` es un bigint sin cota: un
-- cupón de tipo PORCENTAJE con valor 500 es un descuento del 500%, y nada en
-- la base lo impide. Tampoco hay nada que impida que `veces_usado` supere
-- `limite_usos`, ni que un código de invitación otorgue -30 días de acceso.
--
-- Por qué ahora: `cupones` está en CERO filas. Es el momento más barato
-- posible para ponerle restricciones — sin backfill, sin datos que corregir
-- y sin ventana de mantenimiento. Cada mes que pase con filas dentro sube el
-- coste de esta misma migración.
--
-- Todas las condiciones se validaron contra los datos actuales antes de
-- escribir este archivo (SELECT count(*) WHERE NOT (...) por cada una):
-- 12 de 12 con 0 filas en conflicto. Es una comprobación obligatoria, no una
-- cortesía: apply-rls.ts mete los 70+ scripts en UNA transacción, así que un
-- CHECK que no valide no falla solo — tumba la aplicación entera.
--
-- Patrón idempotente de 042: `drop constraint if exists` antes de `add`.
-- ============================================================

-- ------------------------------------------------------------
-- CUPONES. `tipo_descuento` es el enum TipoDescuento
-- (PORCENTAJE | MONTO_FIJO). El tope de 100 solo aplica al primero: un
-- MONTO_FIJO de 50.000 centavos es perfectamente válido.
-- ------------------------------------------------------------
alter table public.cupones drop constraint if exists cupones_valor_no_negativo;
alter table public.cupones add constraint cupones_valor_no_negativo
  check (valor >= 0);

alter table public.cupones drop constraint if exists cupones_porcentaje_max_100;
alter table public.cupones add constraint cupones_porcentaje_max_100
  check (tipo_descuento <> 'PORCENTAJE' or valor <= 100);

alter table public.cupones drop constraint if exists cupones_limite_usos_positivo;
alter table public.cupones add constraint cupones_limite_usos_positivo
  check (limite_usos is null or limite_usos >= 1);

-- `limite_usos` nullable significa "sin límite", de ahí el is null.
alter table public.cupones drop constraint if exists cupones_usos_dentro_del_limite;
alter table public.cupones add constraint cupones_usos_dentro_del_limite
  check (limite_usos is null or veces_usado <= limite_usos);

-- ------------------------------------------------------------
-- CÓDIGOS DE INVITACIÓN. Ya existía codigos_invitacion_limite_usos_positivo
-- (024/035), pero nada acotaba el contador contra ese límite: el CHECK
-- convierte en imposible lo que hoy solo es improbable — dos canjes
-- simultáneos del mismo código pasando la comprobación de la aplicación
-- antes de que ninguno incremente.
-- ------------------------------------------------------------
alter table public.codigos_invitacion drop constraint if exists codigos_usos_dentro_del_limite;
alter table public.codigos_invitacion add constraint codigos_usos_dentro_del_limite
  check (veces_usado <= limite_usos);

alter table public.codigos_invitacion drop constraint if exists codigos_duracion_positiva;
alter table public.codigos_invitacion add constraint codigos_duracion_positiva
  check (duracion_dias >= 1);

alter table public.lotes_codigos_invitacion drop constraint if exists lotes_cantidad_positiva;
alter table public.lotes_codigos_invitacion add constraint lotes_cantidad_positiva
  check (cantidad >= 1 and duracion_dias >= 1);

-- ------------------------------------------------------------
-- PLANES Y SUSCRIPCIONES. `planes.duracion_dias` alimenta el cálculo de
-- fecha_renovacion; un 0 o un negativo produce una suscripción nacida
-- vencida.
-- ------------------------------------------------------------
alter table public.planes drop constraint if exists planes_duracion_positiva;
alter table public.planes add constraint planes_duracion_positiva
  check (duracion_dias >= 1);

alter table public.suscripciones drop constraint if exists suscripciones_renovacion_posterior;
alter table public.suscripciones add constraint suscripciones_renovacion_posterior
  check (fecha_renovacion is null or fecha_renovacion > fecha_inicio);

-- ------------------------------------------------------------
-- EXÁMENES Y PROGRESO. `intentos_examen` ya tiene los CHECK de puntaje y
-- coherencia de estado (067); le faltaba la ventana temporal.
-- ------------------------------------------------------------
alter table public.intentos_examen drop constraint if exists intentos_expira_posterior;
alter table public.intentos_examen add constraint intentos_expira_posterior
  check (expira_en is null or expira_en > iniciado_en);

alter table public.progreso drop constraint if exists progreso_segundo_no_negativo;
alter table public.progreso add constraint progreso_segundo_no_negativo
  check (segundo_actual >= 0);

alter table public.lecciones drop constraint if exists lecciones_duracion_no_negativa;
alter table public.lecciones add constraint lecciones_duracion_no_negativa
  check (duracion is null or duracion >= 0);
