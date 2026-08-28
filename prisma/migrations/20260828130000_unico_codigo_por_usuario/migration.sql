-- ============================================================
-- Restricción de base: un usuario no puede canjear el mismo código dos
-- veces (f4.md, "Requisitos de calidad (nivel senior)": "UNIQUE(user_id,
-- code_id)").
--
-- El bloqueo ya existía a nivel de función (el `exists(...)` de
-- `canjear_codigo_invitacion()` en 035_canje_codigo_por_dias.sql) y es
-- seguro bajo concurrencia porque corre dentro del `for update` que
-- serializa por fila de código. Esta migración cierra el mismo hueco a
-- nivel de esquema, para que la garantía no dependa exclusivamente de que
-- toda escritura pase por esa función -- cualquier INSERT directo con la
-- Service Role Key (fuera del RPC) también queda cubierto.
--
-- Índice parcial, mismo patrón que `suscripcion_activa_unica_por_usuario`
-- (20260818142831_suscripcion_activa_unica_y_pgcrypto): Prisma no soporta
-- índices únicos parciales de forma nativa en schema.prisma, así que se
-- define aquí como SQL crudo. `WHERE id_codigo_invitacion IS NOT NULL`
-- porque solo las suscripciones que nacieron de un código de invitación
-- participan de esta regla -- las de pago (Stripe/Wompi) y las manuales
-- del admin dejan esa columna en NULL y NULL nunca choca con NULL en un
-- índice único.
CREATE UNIQUE INDEX "suscripcion_codigo_unica_por_usuario"
  ON "suscripciones" ("id_usuario", "id_codigo_invitacion")
  WHERE "id_codigo_invitacion" IS NOT NULL;
