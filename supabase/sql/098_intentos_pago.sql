-- ============================================================
-- intentos_pago: RLS y restricciones
--
-- Orden de aplicación (npm run db:rls lo respeta): DESPUÉS de 000-099.
-- No redefine nada anterior: solo agrega una tabla propia.
--
-- Requiere la migración de Prisma `20260914120000_intentos_pago`, que crea
-- la tabla. La secuencia está en README.md: `npx prisma migrate deploy` y
-- luego `npm run db:rls`. Aplicar este archivo sin la migración falla en el
-- primer `alter table`.
--
-- Qué es esta tabla
-- -----------------
-- Un cobro que empezó y todavía no terminó. El estudiante elige plan (y
-- cupón), el servidor calcula el total, inserta una fila aquí con una
-- referencia única y lo manda a Wompi. Cuando el webhook vuelve, esa
-- referencia es lo ÚNICO que permite saber qué se estaba comprando: Wompi
-- no deja consultar una transacción por referencia, solo por su propio id.
--
-- Por qué no hay policy de INSERT ni de UPDATE para `authenticated`
-- -----------------------------------------------------------------
-- Mismo criterio que `suscripciones` y `pagos` (ver la cabecera de 003): lo
-- escribe exclusivamente el backend con la Service Role Key, que ignora RLS.
-- Si el cliente pudiera insertar aquí, podría fijar su propio
-- `monto_centavos` — y ese valor es justamente el que se firma y contra el
-- que se concilia el webhook. Sería regalar el precio.
--
-- El estudiante SÍ lee los suyos: la pantalla de retorno del checkout llega
-- con `?ref=` y necesita saber si el pago ya se confirmó, porque Wompi lo
-- devuelve al sitio normalmente ANTES de que llegue el webhook.
--
-- Todo va con DROP ... IF EXISTS delante porque este archivo se reaplica
-- entero en cada `npm run db:rls`.
-- ============================================================

-- requiere-migracion: 20260914120000_intentos_pago

alter table public.intentos_pago enable row level security;


-- ------------------------------------------------------------
-- Restricciones de dominio
--
-- Mismo criterio que 042 para las columnas de dinero y procedencia: CHECK
-- y no enum de Postgres. `estado` aquí es una etiqueta operativa de ESTA
-- tabla, no una máquina de estados compartida, y un valor de enum no se
-- puede eliminar nunca (existe RENAME VALUE, no existe DROP VALUE).
--
-- La contraparte en TypeScript es src/lib/pagos/proveedores.ts, con un test
-- que lee este archivo y falla si las dos listas se separan.
-- ------------------------------------------------------------
alter table public.intentos_pago
  drop constraint if exists intentos_pago_estado_check;
alter table public.intentos_pago
  add constraint intentos_pago_estado_check
  check (estado in ('PENDIENTE', 'APROBADO', 'RECHAZADO'));

-- Igual que `pagos.moneda` y `suscripciones.moneda` (042): `formatMoneda`
-- se la pasa a Intl.NumberFormat, que lanza RangeError con cualquier cosa
-- que no sea un ISO-4217 bien formado y tumbaría la pantalla de retorno del
-- checkout para ese estudiante.
alter table public.intentos_pago
  drop constraint if exists intentos_pago_moneda_check;
alter table public.intentos_pago
  add constraint intentos_pago_moneda_check
  check (moneda ~ '^[A-Z]{3}$');

-- Un cobro de 0 o negativo no es un cobro. Wompi lo rechazaría igual, pero
-- una fila así aquí significa que el cálculo del descuento se salió de
-- rango — mejor que falle al escribir y no al conciliar.
alter table public.intentos_pago
  drop constraint if exists intentos_pago_monto_positivo_check;
alter table public.intentos_pago
  add constraint intentos_pago_monto_positivo_check
  check (monto_centavos > 0);

-- Un intento APROBADO sin id de transacción es una contradicción: significa
-- que se dio acceso sin saber contra qué cobro. El CHECK lo vuelve
-- imposible en vez de dejarlo a la disciplina del handler.
alter table public.intentos_pago
  drop constraint if exists intentos_pago_aprobado_con_transaccion_check;
alter table public.intentos_pago
  add constraint intentos_pago_aprobado_con_transaccion_check
  check (estado <> 'APROBADO' or id_transaccion_wompi is not null);


-- ------------------------------------------------------------
-- actualizado_en: DEFAULT + trigger
--
-- Prisma NO genera ningún default para `@updatedAt` — lo rellena su propio
-- cliente al escribir. Pero en este proyecto el CRUD corre con
-- `@supabase/supabase-js` para aprovechar RLS (CLAUDE.md §2), así que Prisma
-- no interviene en ningún INSERT real y la columna llegaba NULL contra un
-- NOT NULL.
--
-- Lo detectó `npm run test:pagos` al primer intento:
--   null value in column "actualizado_en" of relation "intentos_pago"
--
-- Las otras 15 tablas del esquema ya tienen `default now()` en esta columna
-- por el mismo motivo; esta se quedó sin él por haberse escrito la migración
-- a mano. El trigger cubre la otra mitad: los UPDATE, donde el default no
-- aplica (mismo patrón que supabase/sql/072 para exámenes).
-- ------------------------------------------------------------
alter table public.intentos_pago
  alter column actualizado_en set default now();

drop trigger if exists set_actualizado_en on public.intentos_pago;
create trigger set_actualizado_en
  before update on public.intentos_pago
  for each row execute function private.actualiza_actualizado_en();


-- ------------------------------------------------------------
-- POLÍTICAS
-- ------------------------------------------------------------
drop policy if exists "intentos_pago_select_propio" on public.intentos_pago;
create policy "intentos_pago_select_propio" on public.intentos_pago
  for select using (auth.uid() = id_usuario or private.es_administrador());

-- El admin necesita poder mirarlos para soporte ("pagué y no me llegó"),
-- mismo alcance que `suscripciones_admin_gestiona`.
drop policy if exists "intentos_pago_admin_gestiona" on public.intentos_pago;
create policy "intentos_pago_admin_gestiona" on public.intentos_pago
  for all using (private.es_administrador())
  with check (private.es_administrador());
