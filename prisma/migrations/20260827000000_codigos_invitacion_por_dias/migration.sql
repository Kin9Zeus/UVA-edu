-- ============================================================
-- Los códigos de invitación otorgan días, no planes
--
-- Contexto: el MVP se adelantó al 12 de septiembre de 2026 y el acceso
-- pasó a darse exclusivamente por códigos de invitación, sin pasarela de
-- pago. Con eso, atar un código a un `plan` dejó de tener sentido:
--
--   - El canje solo usaba el plan para leerle `duracion_dias` y `moneda`
--     (public.canjear_codigo_invitacion, supabase/sql/017). El resto del
--     plan — nombre, precio — nunca se aplicaba a nada.
--   - Obligaba al administrador a traducir "quiero dar 45 días" a "elijo
--     el plan que dure 45 días", y a inventarse un plan cuando no existía
--     ninguno con esa duración.
--   - Dejaba al invitado apareciendo en el panel como suscriptor del
--     "Plan Mensual" sin haber pagado nada.
--
-- Después de esta migración un código lleva sus propios `duracion_dias` y
-- la suscripción que crea el canje no referencia ningún plan.
--
-- Se aplica junto con la reescritura de public.canjear_codigo_invitacion()
-- en supabase/sql/017_canjear_codigo_invitacion.sql, que a partir de aquí
-- lee `codigos_invitacion.duracion_dias` en vez de `planes.duracion_dias`.
-- Orden: primero esta migración, después `npm run db:rls`. Aplicar solo
-- una de las dos deja el canje roto.
-- ============================================================

-- ------------------------------------------------------------
-- 1. codigos_invitacion.duracion_dias
-- ------------------------------------------------------------
-- Se agrega nullable, se rellena y recién entonces se marca NOT NULL: la
-- tabla puede tener filas y un ADD COLUMN NOT NULL sin default las
-- rechazaría. El relleno toma la duración del plan al que el código
-- apuntaba, que es exactamente la que ese código venía otorgando — así
-- ningún código vigente cambia de comportamiento al migrar.
ALTER TABLE "codigos_invitacion" ADD COLUMN "duracion_dias" INTEGER;

UPDATE "codigos_invitacion" c
   SET "duracion_dias" = p."duracion_dias"
  FROM "planes" p
 WHERE p."id" = c."id_plan";

-- Red de seguridad por si algún código quedó apuntando a un plan que ya no
-- existe (la FK lo impide hoy, pero el UPDATE de arriba lo dejaría en NULL
-- y el SET NOT NULL fallaría con un mensaje que no dice qué pasó).
UPDATE "codigos_invitacion" SET "duracion_dias" = 30 WHERE "duracion_dias" IS NULL;

ALTER TABLE "codigos_invitacion" ALTER COLUMN "duracion_dias" SET NOT NULL;

-- ------------------------------------------------------------
-- 2. codigos_invitacion.limite_usos: obligatorio y positivo
-- ------------------------------------------------------------
-- Regla de negocio confirmada para el lanzamiento: un código es de uso
-- único o con un límite, NUNCA ilimitado. Mientras la columna admitiera
-- NULL, el panel podía crear por descuido un código que cualquiera reparte
-- sin tope — y un código filtrado sin tope no se puede contener salvo
-- desactivándolo a mano.
--
-- Los NULL existentes pasan a 1 (uso único), que es la interpretación más
-- restrictiva: si alguno se queda corto, ampliarlo es un UPDATE trivial,
-- mientras que haberlo dejado demasiado abierto ya habría regalado accesos.
UPDATE "codigos_invitacion" SET "limite_usos" = 1 WHERE "limite_usos" IS NULL;

ALTER TABLE "codigos_invitacion" ALTER COLUMN "limite_usos" SET NOT NULL;

-- El CHECK impide además el 0 y los negativos, que pasaban la validación de
-- tipo pero producen un código imposible de canjear.
ALTER TABLE "codigos_invitacion"
  ADD CONSTRAINT "codigos_invitacion_limite_usos_positivo" CHECK ("limite_usos" >= 1);

-- ------------------------------------------------------------
-- 3. codigos_invitacion.id_plan: fuera
-- ------------------------------------------------------------
-- Ya no queda nada que leer del plan: la duración vive en la columna nueva
-- y la moneda la fija el canje ('COP'), porque un acceso regalado no tiene
-- importe que denominar.
ALTER TABLE "codigos_invitacion" DROP CONSTRAINT "codigos_invitacion_id_plan_fkey";
ALTER TABLE "codigos_invitacion" DROP COLUMN "id_plan";

-- ------------------------------------------------------------
-- 4. suscripciones.id_plan: nullable
-- ------------------------------------------------------------
-- Una suscripción creada por un canje no compró ningún plan, así que no
-- tiene ninguno que referenciar. La alternativa era inventar un plan
-- "Acceso por invitación" solo para rellenar la casilla, pero eso mete una
-- fila falsa en el catálogo de planes que aparece en la página de precios
-- salvo que alguien se acuerde de filtrarla a mano.
--
-- Las suscripciones de pago (Stripe/Wompi) y las que otorga el admin desde
-- el panel siguen llenándolo; solo las de `proveedor = 'invitacion'` lo
-- dejan en NULL. Quien lo lee ya tiene valor por defecto: lib/suscripcion.ts
-- y lib/admin/usuarioDetalle.ts muestran "Acceso por invitación".
ALTER TABLE "suscripciones" ALTER COLUMN "id_plan" DROP NOT NULL;
